const { contextBridge, ipcRenderer } = require('electron');

// Exponer APIs de forma segura al renderer
contextBridge.exposeInMainWorld('electronAPI', {
  // Verificaciones del sistema
  checkNode: () => ipcRenderer.invoke('check-node'),
  checkProjectStructure: () => ipcRenderer.invoke('check-project-structure'),
  
  // Instalación
  installDependencies: () => ipcRenderer.invoke('install-dependencies'),
  installBrowsers: () => ipcRenderer.invoke('install-browsers'),
  
  // Ejecución de pruebas
  runTestsUI: () => ipcRenderer.invoke('run-tests-ui'),
  runTests: () => ipcRenderer.invoke('run-tests'),
  showReport: () => ipcRenderer.invoke('show-report'),
  
  // Utilidades
  openFolder: () => ipcRenderer.invoke('open-folder'),
  selectFolder: () => ipcRenderer.invoke('select-folder'),
  
  // Listeners para eventos
  onInstallProgress: (callback) => ipcRenderer.on('install-progress', callback),
  onTestOutput: (callback) => ipcRenderer.on('test-output', callback),
  
  // Remover listeners
  removeAllListeners: (channel) => ipcRenderer.removeAllListeners(channel)
});