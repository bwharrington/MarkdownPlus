// Type definitions for the Electron API exposed via preload script

export type LineEnding = 'CRLF' | 'LF';
export type ViewMode = 'edit' | 'preview';

export interface FileOpenResult {
  filePath: string;
  content: string;
  lineEnding: LineEnding;
}

export interface FileSaveResult {
  success: boolean;
  filePath: string;
  error?: string;
}

export interface IConfig {
  recentFiles: string[];
  openFiles: string[];
  windowBounds?: {
    width: number;
    height: number;
    x: number;
    y: number;
  };
  defaultLineEnding: LineEnding;
}

export interface ConfirmCloseResult {
  action: 'save' | 'discard' | 'cancel';
}

export interface ElectronAPI {
  // File operations
  newFile: () => Promise<void>;
  openFile: () => Promise<FileOpenResult[] | null>;
  readFile: (filePath: string) => Promise<FileOpenResult | null>;
  saveFile: (filePath: string, content: string) => Promise<FileSaveResult>;
  saveFileAs: (content: string, defaultName?: string) => Promise<FileSaveResult | null>;
  renameFile: (oldPath: string, newPath: string) => Promise<{ success: boolean }>;
  watchFile: (filePath: string) => Promise<void>;
  unwatchFile: (filePath: string) => Promise<void>;  
  // Config operations
  loadConfig: () => Promise<IConfig>;
  saveConfig: (config: IConfig) => Promise<void>;
  openConfig: () => Promise<FileOpenResult | null>;
  syncRecentFiles: (openFiles: string[]) => Promise<void>;
  
  // Get initial files from command line
  getInitialFiles: () => Promise<string[]>;
  
  // Signal that renderer is ready
  rendererReady: () => Promise<string[]>;
  
  // Dialog operations
  confirmClose: (fileName: string) => Promise<ConfirmCloseResult>;
  showExternalChangeDialog: (fileName: string) => Promise<'reload' | 'keep'>;
  
  // Window operations
  setWindowTitle: (title: string) => Promise<void>;
  getWindowBounds: () => Promise<{ width: number; height: number; x: number; y: number }>;
  minimizeWindow: () => Promise<void>;
  maximizeWindow: () => Promise<void>;
  closeWindow: () => Promise<void>;  
  // Shell operations
  showInFolder: (filePath: string) => Promise<void>;
  
  // DevTools operations
  toggleDevTools: () => Promise<boolean>;
  getDevToolsState: () => Promise<boolean>;
  
  // Log operations
  getLogPath: () => Promise<string>;
  
  // Console logging
  sendConsoleLog: (level: string, ...args: any[]) => void;
  
  // Menu event listeners (return cleanup functions)
  onMenuNew: (callback: () => void) => () => void;
  onMenuOpen: (callback: () => void) => () => void;
  onMenuSave: (callback: () => void) => () => void;
  onMenuSaveAs: (callback: () => void) => () => void;
  onMenuSaveAll: (callback: () => void) => () => void;
  onMenuClose: (callback: () => void) => () => void;
  onMenuCloseAll: (callback: () => void) => () => void;
  onMenuShowInFolder: (callback: () => void) => () => void;
  onMenuOpenRecent: (callback: (filePath: string) => void) => () => void;
  onExternalFileChange: (callback: (filePath: string) => void) => () => void;
  onOpenFilesFromArgs: (callback: (filePaths: string[]) => void) => () => void;
}

declare global {
  interface Window {
    electronAPI: ElectronAPI;
  }
}

export {};
