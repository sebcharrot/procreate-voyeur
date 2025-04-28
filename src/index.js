const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');

let mainWindow;
let openedFilePath = 'No file opened';
let isDev;

// Handle request for file path
ipcMain.handle('get-opened-file', () => {
  return openedFilePath;
});

// Main flow -- wait for ready then create the window
app.whenReady().then(() => {
  const filePath = process.argv.find(arg => arg.endsWith('.procreate'));
  
  if (filePath) {
    openedFilePath = filePath;
  } else {
    openedFilePath = getDefaultProcreatePath();
  }

  // Hardcode if we're in dev mode
  if (openedFilePath === 'No file opened') {
    openedFilePath = getDefaultProcreatePath();
    console.log('[DEV] Using hardcoded .procreate file:', openedFilePath);
  }

  createWindow();
});

function getDefaultProcreatePath() {
  const isDev = !app.isPackaged;
  return isDev
    ? path.join(__dirname, '../assets/default.procreate') // adjust for dev path
    : path.join(process.resourcesPath, 'default.procreate'); // for production
}

// Create the main window
const createWindow = () => {
  mainWindow = new BrowserWindow({
    show: false,
    icon: path.join(__dirname, '..', 'favicon.ico'),
    webPreferences: {
      preload: path.join(__dirname, '..', 'preload.js'), // if preload.js is at root
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false
    },
  });

  mainWindow.maximize();

  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
  });

  mainWindow.loadFile(path.join(__dirname, 'index.html'));

  // When ready, load file
  mainWindow.webContents.on('did-finish-load', () => {
    if (openedFilePath && openedFilePath !== 'No file opened') {
      // Set window title
      const baseName = path.basename(openedFilePath, '.procreate');
      mainWindow.setTitle(`${baseName} — Voyeur (Procreate Viewer)`);
      // Load the file
      console.log('[MAIN] Sending load-procreate-file:', openedFilePath);
      mainWindow.webContents.send('load-procreate-file', openedFilePath); // Caught by preload.js
    } else {
      console.log('[MAIN] No .procreate file to load yet.');
    }
  });
};

