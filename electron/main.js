import { app, BrowserWindow, ipcMain, dialog } from 'electron';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const isDev = process.env.NODE_ENV === 'development';

// Allow autoplay with audio without user interaction
app.commandLine.appendSwitch('autoplay-policy', 'no-user-gesture-required');

function createWindow() {
  const mainWindow = new BrowserWindow({
    width: 1280,
    height: 720,
    icon: path.join(__dirname, '../public/assets/icon.png'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: true,
      contextIsolation: false,
      webSecurity: false,
    },
    fullscreen: true,
    autoHideMenuBar: true,
  });

  if (isDev) {
    mainWindow.loadURL('http://127.0.0.1:5173');
    mainWindow.webContents.openDevTools({ mode: 'detach' });
  } else {
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));
  }
}

app.whenReady().then(() => {
  ipcMain.on('app:quit', () => {
    app.quit();
  });

  ipcMain.handle('dialog:openDirectory', async () => {
    const result = await dialog.showOpenDialog({
      properties: ['openDirectory']
    });
    return result;
  });

  ipcMain.handle('dialog:openFile', async (event, options = {}) => {
    const result = await dialog.showOpenDialog({
      properties: ['openFile'],
      filters: options.filters || []
    });
    return result;
  });

  const CONFIG_FILE = isDev 
    ? path.join(__dirname, '../config.json') 
    : path.join(path.dirname(app.getPath('exe')), 'config.json');

  ipcMain.handle('config:save', (event, data) => {
    try {
      fs.writeFileSync(CONFIG_FILE, JSON.stringify(data, null, 2));
      return true;
    } catch (e) {
      console.error('Failed to save config:', e);
      return false;
    }
  });

  ipcMain.handle('config:load', () => {
    try {
      if (fs.existsSync(CONFIG_FILE)) {
        return JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf8'));
      }
    } catch (e) {
      console.error('Failed to load config:', e);
    }
    return null;
  });

  createWindow();

  app.on('activate', function () {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', function () {
  if (process.platform !== 'darwin') app.quit();
});
