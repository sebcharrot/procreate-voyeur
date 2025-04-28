const { contextBridge, ipcRenderer } = require('electron');
const fs = require('fs');
const JSZip = require('jszip');

let thumbnailCallback = null;

// Expose API to renderer process
contextBridge.exposeInMainWorld('myAPI', {
  getOpenedFilePath: () => ipcRenderer.invoke('get-opened-file'),

  onThumbnail: (cb) => {
    thumbnailCallback = cb;
  }
});

// Receive file from main and process it
ipcRenderer.on('load-procreate-file', (event, filePath) => {
  fs.readFile(filePath, async (err, data) => {
    if (err) return;

    try {
      const zip = await JSZip.loadAsync(data);
      const thumb = zip.files['QuickLook/Thumbnail.png'];

      if (!thumb) {
        return;
      }

      const base64Thumb = await thumb.async('base64');
      
      if (thumbnailCallback) {
        thumbnailCallback(base64Thumb);
      }
    } catch (e) {
      console.error('[Preload] Failed to unzip:', e);
    }
  });
});
