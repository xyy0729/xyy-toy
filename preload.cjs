const { contextBridge, ipcRenderer } = require('electron');
contextBridge.exposeInMainWorld('pet', {
  dragStart: () => ipcRenderer.send('pet:drag-start'),
  dragMove: () => ipcRenderer.send('pet:drag-move'),
  dragEnd: () => ipcRenderer.send('pet:drag-end'),
  menu: () => ipcRenderer.send('pet:menu'),
  onAction: callback => ipcRenderer.on('pet:action', (_event, action) => callback(action)),
  onAppearance: callback => ipcRenderer.on('pet:appearance', (_event, image) => callback(image))
});
