import { app, BrowserWindow, ipcMain } from 'electron';
import path from 'path';
import { fileURLToPath } from 'url';
import { spawn } from 'child_process';
import fs from 'fs';
import http from 'http';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let mainWindow;
let backendProcess = null;

// ─────────────────────────────────────────────────────────────────────────────
// Logging helper — writes to %APPDATA%\Intelli IPS\app-debug.log
// ─────────────────────────────────────────────────────────────────────────────
function logToFile(msg) {
  try {
    const logPath = path.join(app.getPath('userData'), 'app-debug.log');
    fs.appendFileSync(logPath, `[${new Date().toISOString()}] ${msg}\n`);
  } catch (e) {
    console.error(e);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// IPC — let preload / renderer ask for the userData path
// ─────────────────────────────────────────────────────────────────────────────
ipcMain.on('get-userdata-path', (event) => {
  event.returnValue = app.getPath('userData');
});

// ─────────────────────────────────────────────────────────────────────────────
// Poll http://127.0.0.1:8000 until the backend responds, then send IPC event
// ─────────────────────────────────────────────────────────────────────────────
function waitForBackend(win, maxWaitMs = 20000, intervalMs = 600) {
  logToFile(`Waiting for backend on port 8000 (max ${maxWaitMs}ms)…`);
  const startTime = Date.now();

  function check() {
    const req = http.get('http://127.0.0.1:8000/', (res) => {
      if (res.statusCode === 200 || res.statusCode === 404) {
        logToFile('Backend is ready — sending backend-ready to renderer');
        if (win && !win.isDestroyed()) {
          win.webContents.send('backend-ready');
        }
      } else {
        scheduleNext();
      }
      res.resume();
    });

    req.setTimeout(500);
    req.on('error', () => scheduleNext());
    req.on('timeout', () => { req.destroy(); scheduleNext(); });
  }

  function scheduleNext() {
    if (Date.now() - startTime < maxWaitMs) {
      setTimeout(check, intervalMs);
    } else {
      logToFile('Backend did not become ready within timeout — continuing anyway');
      // Send anyway so frontend doesn't wait forever
      if (win && !win.isDestroyed()) {
        win.webContents.send('backend-ready');
      }
    }
  }

  check();
}

// ─────────────────────────────────────────────────────────────────────────────
// Start the Python backend executable (packaged mode only)
// ─────────────────────────────────────────────────────────────────────────────
function startBackend() {
  logToFile('startBackend called');

  if (app.isPackaged) {
    const backendPath = path.join(process.resourcesPath, 'backend', 'ips_backend.exe');
    const backendDir = path.dirname(backendPath);
    logToFile(`Backend path: ${backendPath}`);

    if (!fs.existsSync(backendPath)) {
      logToFile(`ERROR: backend executable not found at ${backendPath}`);
      return;
    }

    // Pass the userData path so the backend can store files there
    const env = {
      ...process.env,
      IPS_USERDATA: app.getPath('userData'),
    };

    try {
      backendProcess = spawn(backendPath, [], {
        cwd: backendDir,
        windowsHide: true,
        env,
      });

      logToFile(`Backend spawned with PID: ${backendProcess.pid}`);

      backendProcess.stdout.on('data', (d) =>
        logToFile(`[backend stdout] ${d.toString().trim()}`)
      );
      backendProcess.stderr.on('data', (d) =>
        logToFile(`[backend stderr] ${d.toString().trim()}`)
      );
      backendProcess.on('error', (err) =>
        logToFile(`Backend spawn error: ${err.message}`)
      );
      backendProcess.on('close', (code) =>
        logToFile(`Backend process exited with code ${code}`)
      );
    } catch (e) {
      logToFile(`Exception spawning backend: ${e.message}`);
    }
  } else {
    logToFile('Dev mode — skipping backend spawn (run backend manually)');
  }
}

function killBackend() {
  if (backendProcess) {
    logToFile('Terminating backend process…');
    try {
      // On Windows, spawn a taskkill to ensure all child processes die too
      if (process.platform === 'win32' && backendProcess.pid) {
        spawn('taskkill', ['/pid', String(backendProcess.pid), '/f', '/t'], {
          windowsHide: true,
        });
      } else {
        backendProcess.kill();
      }
      logToFile('Backend terminated.');
    } catch (e) {
      logToFile(`Error killing backend: ${e.message}`);
    }
    backendProcess = null;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Create the main BrowserWindow
// ─────────────────────────────────────────────────────────────────────────────
function createWindow() {
  logToFile('createWindow called');

  const iconPath = app.isPackaged
    ? path.join(process.resourcesPath, 'build', 'icon.ico')
    : path.join(__dirname, '../build/icon.ico');

  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1000,
    minHeight: 650,
    icon: iconPath,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      enableRemoteModule: false,
      preload: path.join(__dirname, 'preload.js'),
    },
    backgroundColor: '#000000',
    titleBarStyle: 'default',
    show: false,
  });

  if (!app.isPackaged && process.env.NODE_ENV !== 'production') {
    // Dev mode — load Vite dev server
    mainWindow.loadURL('http://localhost:3000');
    mainWindow.webContents.openDevTools();
  } else {
    // Packaged — load the built index.html
    const htmlPath = path.join(__dirname, '../dist/index.html');
    logToFile(`Loading HTML from: ${htmlPath}`);
    mainWindow.loadFile(htmlPath);
  }

  mainWindow.once('ready-to-show', () => {
    logToFile('Window ready-to-show');
    mainWindow.show();

    // Start polling for backend readiness
    if (app.isPackaged) {
      waitForBackend(mainWindow);
    }
  });

  mainWindow.on('closed', () => {
    logToFile('Main window closed');
    mainWindow = null;
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// App lifecycle
// ─────────────────────────────────────────────────────────────────────────────
app.whenReady().then(() => {
  logToFile('=== app.whenReady ===');

  // Ensure the userData directory exists so config.env can be placed there
  const userDataDir = app.getPath('userData');
  if (!fs.existsSync(userDataDir)) {
    fs.mkdirSync(userDataDir, { recursive: true });
  }
  logToFile(`userData dir: ${userDataDir}`);

  startBackend();
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  logToFile('window-all-closed');
  killBackend();
  if (process.platform !== 'darwin') app.quit();
});

app.on('will-quit', () => {
  logToFile('will-quit');
  killBackend();
});
