import { contextBridge, ipcRenderer } from 'electron';
import fs from 'fs';
import path from 'path';

/**
 * Read the Groq API key from several candidate locations, in priority order:
 *
 * 1. Dev mode  → project-root/.env.local  (resolved relative to preload.js)
 * 2. Packaged  → the userData dir sent from main via IPC ('get-userdata-path')
 *               which on Windows is %APPDATA%\Intelli IPS\config.env   or  .env.local
 * 3. Fallback  → the key baked into the bundle by Vite at build time
 *               (process.env.GROQ_API_KEY is replaced by a literal string)
 */

// ---------------------------------------------------------------------------
// Synchronous helper — tries a list of absolute file paths for the key
// ---------------------------------------------------------------------------
function readKeyFromFiles(candidates) {
  for (const filePath of candidates) {
    try {
      if (fs.existsSync(filePath)) {
        const content = fs.readFileSync(filePath, 'utf-8');
        const match = content.match(/GROQ_API_KEY\s*=\s*(.+)/);
        if (match && match[1]) {
          let val = match[1].trim();
          // Strip surrounding quotes
          if (
            (val.startsWith('"') && val.endsWith('"')) ||
            (val.startsWith("'") && val.endsWith("'"))
          ) {
            val = val.slice(1, -1);
          }
          if (val.length > 10) return val;
        }
      }
    } catch (_) {
      // ignore read errors and try next path
    }
  }
  return null;
}

// ---------------------------------------------------------------------------
// Build candidate path list synchronously (called each time getApiKey fires)
// ---------------------------------------------------------------------------
function buildCandidates() {
  const candidates = [];

  // ── Dev mode: project root is two levels above electron/preload.js ───────
  try {
    const preloadDir = path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1'));
    candidates.push(
      path.join(preloadDir, '../.env.local'),
      path.join(preloadDir, '../.env'),
    );
  } catch (_) {}

  // ── Packaged: resources path sibling files ────────────────────────────────
  if (process.resourcesPath) {
    candidates.push(
      path.join(process.resourcesPath, '..', '.env.local'),
      path.join(process.resourcesPath, '..', 'config.env'),
    );
  }

  // ── Windows APPDATA — use the app name that electron-builder uses ─────────
  if (process.platform === 'win32' && process.env.APPDATA) {
    const appDataNames = ['Intelli IPS', 'intelli-ips', 'ids-sentinel'];
    const fileNames = ['config.env', '.env.local', '.env'];
    for (const dir of appDataNames) {
      for (const file of fileNames) {
        candidates.push(path.join(process.env.APPDATA, dir, file));
      }
    }
  }

  return candidates;
}

// ---------------------------------------------------------------------------
// Main exported function
// ---------------------------------------------------------------------------
function getApiKey() {
  // 1. Try file-based sources
  const fileKey = readKeyFromFiles(buildCandidates());
  if (fileKey) return fileKey;

  // 2. Fall back to the key baked in by Vite at build time.
  //    (Vite replaces process.env.GROQ_API_KEY with the literal string.)
  const builtInKey = process.env.GROQ_API_KEY;
  if (typeof builtInKey === 'string' && builtInKey.length > 10) return builtInKey;

  return null;
}

// ---------------------------------------------------------------------------
// Expose to renderer via contextBridge
// ---------------------------------------------------------------------------
contextBridge.exposeInMainWorld('electron', {
  /** Returns the Groq API key or null */
  getApiKey: () => getApiKey(),

  /**
   * Ask main process for the user-data directory path so the renderer can
   * show helpful error messages (e.g. "place config.env in <path>").
   */
  getUserDataPath: () => ipcRenderer.sendSync('get-userdata-path'),

  /** Backend readiness — resolves true once the Python backend is up */
  onBackendReady: (callback) => ipcRenderer.on('backend-ready', callback),
});
