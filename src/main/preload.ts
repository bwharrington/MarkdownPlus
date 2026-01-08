import { contextBridge, ipcRenderer } from 'electron';

// Define the API that will be exposed to the renderer process
const electronAPI = {
  // File operations
  newFile: () => ipcRenderer.invoke('file:new'),
  openFile: () => ipcRenderer.invoke('file:open'),
  readFile: (filePath: string) => ipcRenderer.invoke('file:read', filePath),
  saveFile: (filePath: string, content: string) => ipcRenderer.invoke('file:save', filePath, content),
  saveFileAs: (content: string, defaultName?: string) => ipcRenderer.invoke('file:save-as', content, defaultName),
  
  // Config operations
  loadConfig: () => ipcRenderer.invoke('config:load'),
  saveConfig: (config: unknown) => ipcRenderer.invoke('config:save', config),
  openConfig: () => ipcRenderer.invoke('config:open'),
  syncRecentFiles: (openFiles: string[]) => ipcRenderer.invoke('config:sync-recent-files', openFiles),
  
  // Dialog operations
  confirmClose: (fileName: string) => ipcRenderer.invoke('dialog:confirm-close', fileName),
  showExternalChangeDialog: (fileName: string) => ipcRenderer.invoke('dialog:external-change', fileName),
  
  // Window operations
  setWindowTitle: (title: string) => ipcRenderer.invoke('window:set-title', title),
  getWindowBounds: () => ipcRenderer.invoke('window:get-bounds'),
  minimizeWindow: () => ipcRenderer.invoke('window:minimize'),
  maximizeWindow: () => ipcRenderer.invoke('window:maximize'),
  closeWindow: () => ipcRenderer.invoke('window:close'),
  
  // Shell operations
  showInFolder: (filePath: string) => ipcRenderer.invoke('shell:show-in-folder', filePath),
  
  // Menu event listeners
  onMenuNew: (callback: () => void) => {
    ipcRenderer.on('menu:new', callback);
    return () => ipcRenderer.removeListener('menu:new', callback);
  },
  onMenuOpen: (callback: () => void) => {
    ipcRenderer.on('menu:open', callback);
    return () => ipcRenderer.removeListener('menu:open', callback);
  },
  onMenuSave: (callback: () => void) => {
    ipcRenderer.on('menu:save', callback);
    return () => ipcRenderer.removeListener('menu:save', callback);
  },
  onMenuSaveAs: (callback: () => void) => {
    ipcRenderer.on('menu:save-as', callback);
    return () => ipcRenderer.removeListener('menu:save-as', callback);
  },
  onMenuSaveAll: (callback: () => void) => {
    ipcRenderer.on('menu:save-all', callback);
    return () => ipcRenderer.removeListener('menu:save-all', callback);
  },
  onMenuClose: (callback: () => void) => {
    ipcRenderer.on('menu:close', callback);
    return () => ipcRenderer.removeListener('menu:close', callback);
  },
  onMenuCloseAll: (callback: () => void) => {
    ipcRenderer.on('menu:close-all', callback);
    return () => ipcRenderer.removeListener('menu:close-all', callback);
  },
  onMenuShowInFolder: (callback: () => void) => {
    ipcRenderer.on('menu:show-in-folder', callback);
    return () => ipcRenderer.removeListener('menu:show-in-folder', callback);
  },
  onMenuOpenRecent: (callback: (filePath: string) => void) => {
    ipcRenderer.on('menu:open-recent', (_event, filePath: string) => callback(filePath));
    return () => ipcRenderer.removeAllListeners('menu:open-recent');
  },
  onExternalFileChange: (callback: (filePath: string) => void) => {
    ipcRenderer.on('file:external-change', (_event, filePath: string) => callback(filePath));
    return () => ipcRenderer.removeAllListeners('file:external-change');
  },
};

// Expose the API to the renderer process
contextBridge.exposeInMainWorld('electronAPI', electronAPI);

// Export type for use in renderer
export type ElectronAPI = typeof electronAPI;
