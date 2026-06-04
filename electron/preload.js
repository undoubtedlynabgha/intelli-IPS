import { contextBridge, ipcRenderer } from 'electron';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Function to read API key from config file
// Note: In preload, we can't use app.getPath, so we'll use a standard location
function getApiKey() {
  try {
    // Try reading from .env.local in development (relative to preload location)
    const envLocalPath = path.join(__dirname, '../.env.local');
    if (fs.existsSync(envLocalPath)) {
      const envContent = fs.readFileSync(envLocalPath, 'utf-8');
      const match = envContent.match(/GEMINI_API_KEY=(.+)/);
      if (match && match[1]) {
        return match[1].trim();
      }
    }
    
    // For packaged app, try user data directory
    // We'll use a standard Windows path (can be enhanced for cross-platform)
    if (process.platform === 'win32' && process.env.APPDATA) {
      const configPath = path.join(process.env.APPDATA, 'ids-sentinel', 'config.env');
      if (fs.existsSync(configPath)) {
        const configContent = fs.readFileSync(configPath, 'utf-8');
        const match = configContent.match(/GEMINI_API_KEY=(.+)/);
        if (match && match[1]) {
          return match[1].trim();
        }
      }
    }
  } catch (error) {
    console.error('Error reading config file:', error);
  }
  return null;
}

// Expose protected methods that allow the renderer process to use
// the APIs we want to expose
contextBridge.exposeInMainWorld('electron', {
  getApiKey: () => getApiKey(),
  // Add any other electron APIs you want to expose here
});

