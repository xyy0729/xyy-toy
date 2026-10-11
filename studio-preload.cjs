const { contextBridge, ipcRenderer } = require('electron');
contextBridge.exposeInMainWorld('studio', {
  choose: () => ipcRenderer.invoke('studio:choose'),
  generate: options => ipcRenderer.invoke('studio:generate', options),
  cancel: () => ipcRenderer.send('studio:cancel'),
  apply: () => ipcRenderer.invoke('studio:apply'),
  onProgress: callback => ipcRenderer.on('studio:progress', (_event, progress) => callback(progress))
});
