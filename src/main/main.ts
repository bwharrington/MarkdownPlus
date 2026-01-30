import { app, BrowserWindow, dialog, Menu, ipcMain, shell } from 'electron';
import * as path from 'path';
import * as fs from 'fs/promises';
import * as fsSync from 'fs';
import { initLogger, log, logError, flushLogsSync, getLogFilePath } from './logger';

let mainWindow: BrowserWindow | null;
let pendingFilesToOpen: string[] = [];
let fileWatchers: Map<string, fsSync.FSWatcher> = new Map();

// Supported markdown file extensions (for Windows file associations)
const MARKDOWN_EXTENSIONS = ['.md', '.markdown', '.mdown', '.mkd', '.mkdn', '.mdx', '.mdwn'];

// Check if a file path is a markdown file
function isMarkdownFile(filePath: string): boolean {
    const lowerPath = filePath.toLowerCase();
    return MARKDOWN_EXTENSIONS.some(ext => lowerPath.endsWith(ext));
}

// Config file path - next to the app executable
const getConfigPath = () => {
    // In development, use the project root; in production, use the app's directory
    const appPath = app.isPackaged 
        ? path.dirname(app.getPath('exe'))
        : app.getAppPath();
    return path.join(appPath, 'config.json');
};

// Default config
const defaultConfig = {
    recentFiles: [] as { fileName: string; mode: 'edit' | 'preview' }[],
    openFiles: [] as { fileName: string; mode: 'edit' | 'preview' }[],
    defaultLineEnding: 'CRLF' as const,
    devToolsOpen: false,
};

// Detect line ending in content
function detectLineEnding(content: string): 'CRLF' | 'LF' {
    if (content.includes('\r\n')) {
        return 'CRLF';
    }
    return 'LF';
}

// Normalize line endings for saving
function normalizeLineEndings(content: string, lineEnding: 'CRLF' | 'LF'): string {
    // First normalize to LF
    const normalized = content.replace(/\r\n/g, '\n');
    // Then convert to target
    if (lineEnding === 'CRLF') {
        return normalized.replace(/\n/g, '\r\n');
    }
    return normalized;
}

// Load config from file
async function loadConfig() {
    try {
        const configPath = getConfigPath();
        const data = await fs.readFile(configPath, 'utf-8');
        const loadedConfig = JSON.parse(data);

        // Handle migration from old format (string arrays) to new format (object arrays)
        // If recentFiles or openFiles contain strings instead of objects, reset them
        if (loadedConfig.recentFiles && Array.isArray(loadedConfig.recentFiles) && loadedConfig.recentFiles.length > 0) {
            if (typeof loadedConfig.recentFiles[0] === 'string') {
                loadedConfig.recentFiles = [];
            }
        }
        if (loadedConfig.openFiles && Array.isArray(loadedConfig.openFiles) && loadedConfig.openFiles.length > 0) {
            if (typeof loadedConfig.openFiles[0] === 'string') {
                loadedConfig.openFiles = [];
            }
        }

        return { ...defaultConfig, ...loadedConfig };
    } catch {
        return defaultConfig;
    }
}

// Save config to file
async function saveConfig(config: typeof defaultConfig) {
    try {
        const configPath = getConfigPath();
        await fs.writeFile(configPath, JSON.stringify(config, null, 2), 'utf-8');
    } catch (error) {
        console.error('Failed to save config:', error);
    }
}

// Open config file for editing - creates if doesn't exist
async function openConfigFile(): Promise<{ filePath: string; content: string; lineEnding: 'CRLF' | 'LF' } | null> {
    const configPath = getConfigPath();
    try {
        // Check if file exists, if not create it with defaults
        try {
            await fs.access(configPath);
        } catch {
            // File doesn't exist, create it
            await fs.writeFile(configPath, JSON.stringify(defaultConfig, null, 2), 'utf-8');
        }
        
        const content = await fs.readFile(configPath, 'utf-8');
        const lineEnding = detectLineEnding(content);
        return { filePath: configPath, content, lineEnding };
    } catch (error) {
        console.error('Failed to open config file:', error);
        return null;
    }
}

// Watch a file for external changes
function watchFile(filePath: string) {
    // Don't watch if already watching
    if (fileWatchers.has(filePath)) {
        return;
    }

    try {
        const watcher = fsSync.watch(filePath, (eventType) => {
            if (eventType === 'change') {
                log('File changed externally', { filePath });
                // Notify renderer
                if (mainWindow && !mainWindow.isDestroyed()) {
                    mainWindow.webContents.send('file:external-change', filePath);
                }
            }
        });

        fileWatchers.set(filePath, watcher);
        log('Started watching file', { filePath });
    } catch (error) {
        logError(`Failed to watch file: ${filePath}`, error as Error);
    }
}

// Stop watching a file
function unwatchFile(filePath: string) {
    const watcher = fileWatchers.get(filePath);
    if (watcher) {
        watcher.close();
        fileWatchers.delete(filePath);
        log('Stopped watching file', { filePath });
    }
}

// Register IPC handlers
function registerIpcHandlers() {
    // File: Open dialog
    ipcMain.handle('file:open', async () => {
        const result = await dialog.showOpenDialog(mainWindow!, {
            filters: [
                { name: 'Markup Files', extensions: ['md', 'markdown', 'mdown', 'mkd', 'mkdn', 'mdx', 'mdwn', 'rst', 'rest'] },
                { name: 'Text Files', extensions: ['txt'] },
                { name: 'Other Markup', extensions: ['adoc', 'asciidoc', 'org', 'textile'] },
                { name: 'All Files', extensions: ['*'] },
            ],
            properties: ['openFile', 'multiSelections'],
        });

        if (result.canceled || result.filePaths.length === 0) {
            return null;
        }

        // Read all selected files
        const files = [];
        for (const filePath of result.filePaths) {
            try {
                const content = await fs.readFile(filePath, 'utf-8');
                const lineEnding = detectLineEnding(content);
                files.push({ filePath, content, lineEnding });
            } catch (error) {
                console.error(`Failed to read file ${filePath}:`, error);
            }
        }
        
        return files.length > 0 ? files : null;
    });

    // File: Read specific file
    ipcMain.handle('file:read', async (_event, filePath: string) => {
        log('IPC: file:read called', { filePath });
        try {
            const content = await fs.readFile(filePath, 'utf-8');
            const lineEnding = detectLineEnding(content);
            log('IPC: file:read success', { filePath, contentLength: content.length, lineEnding });
            return { filePath, content, lineEnding };
        } catch (error) {
            logError('IPC: file:read failed', error);
            return null;
        }
    });

    // File: Save to existing path
    ipcMain.handle('file:save', async (_event, filePath: string, content: string) => {
        try {
            // Detect original line ending and preserve it
            let lineEnding: 'CRLF' | 'LF' = 'LF';
            try {
                const originalContent = await fs.readFile(filePath, 'utf-8');
                lineEnding = detectLineEnding(originalContent);
            } catch {
                // File might not exist yet, use default
                lineEnding = process.platform === 'win32' ? 'CRLF' : 'LF';
            }
            
            const normalizedContent = normalizeLineEndings(content, lineEnding);
            await fs.writeFile(filePath, normalizedContent, 'utf-8');
            return { success: true, filePath };
        } catch (error) {
            console.error('Failed to save file:', error);
            return { success: false, filePath, error: String(error) };
        }
    });

    // File: Save As dialog
    ipcMain.handle('file:save-as', async (_event, content: string, defaultName?: string) => {
        const result = await dialog.showSaveDialog(mainWindow!, {
            defaultPath: defaultName || 'Untitled.md',
            filters: [
                { name: 'Markdown', extensions: ['md'] },
                { name: 'Text Files', extensions: ['txt'] },
                { name: 'All Files', extensions: ['*'] },
            ],
        });

        if (result.canceled || !result.filePath) {
            return null;
        }

        try {
            const lineEnding = process.platform === 'win32' ? 'CRLF' : 'LF';
            const normalizedContent = normalizeLineEndings(content, lineEnding);
            await fs.writeFile(result.filePath, normalizedContent, 'utf-8');
            return { success: true, filePath: result.filePath };
        } catch (error) {
            console.error('Failed to save file:', error);
            return { success: false, filePath: result.filePath, error: String(error) };
        }
    });

    // File: Rename
    ipcMain.handle('file:rename', async (_event, oldPath: string, newPath: string) => {
        try {
            await fs.rename(oldPath, newPath);
            return { success: true };
        } catch (error) {
            console.error('Failed to rename file:', error);
            throw error;
        }
    });

    // Config: Load
    ipcMain.handle('config:load', async () => {
        return await loadConfig();
    });

    // Config: Save
    ipcMain.handle('config:save', async (_event, config) => {
        await saveConfig(config);
    });

    // Config: Open for editing
    ipcMain.handle('config:open', async () => {
        return await openConfigFile();
    });

    // Get initial files to open (from command line)
    ipcMain.handle('get-initial-files', () => {
        log('IPC: get-initial-files called', { pendingFiles: pendingFilesToOpen });
        const files = pendingFilesToOpen;
        pendingFilesToOpen = []; // Clear after retrieving
        log('IPC: Returning files and clearing pending', { files });
        return files;
    });

    // Renderer ready - send pending files
    ipcMain.handle('renderer-ready', () => {
        log('IPC: renderer-ready called', { pendingFiles: pendingFilesToOpen });
        if (pendingFilesToOpen.length > 0 && mainWindow && !mainWindow.isDestroyed()) {
            log('Sending files to renderer after ready signal', { files: pendingFilesToOpen });
            mainWindow.webContents.send('open-files-from-args', pendingFilesToOpen);
            log('IPC event "open-files-from-args" sent to renderer');
            const files = [...pendingFilesToOpen];
            pendingFilesToOpen = []; // Clear after sending
            log('Returning files from renderer-ready', { files });
            return files;
        }
        log('No files to send from renderer-ready');
        return [];
    });

    // Config: Sync recent files with open files
    ipcMain.handle('config:sync-recent-files', async (_event, openFiles: { fileName: string; mode: 'edit' | 'preview' }[]) => {
        const config = await loadConfig();
        const newConfig = {
            ...config,
            recentFiles: openFiles,
            openFiles: openFiles,
        };
        await saveConfig(newConfig);
    });

    // Dialog: Confirm close
    ipcMain.handle('dialog:confirm-close', async (_event, fileName: string) => {
        const result = await dialog.showMessageBox(mainWindow!, {
            type: 'question',
            buttons: ['Save', "Don't Save", 'Cancel'],
            defaultId: 0,
            cancelId: 2,
            title: 'Unsaved Changes',
            message: `Do you want to save changes to "${fileName}"?`,
            detail: 'Your changes will be lost if you don\'t save them.',
        });

        const actions = ['save', 'discard', 'cancel'] as const;
        return { action: actions[result.response] };
    });

    // DevTools: Toggle
    ipcMain.handle('devtools:toggle', async () => {
        if (mainWindow && !mainWindow.isDestroyed()) {
            if (mainWindow.webContents.isDevToolsOpened()) {
                mainWindow.webContents.closeDevTools();
                // Config will be saved by devtools-closed event listener
                return false;
            } else {
                mainWindow.webContents.openDevTools();
                // Config will be saved by devtools-opened event listener
                return true;
            }
        }
        return false;
    });

    // DevTools: Get state
    ipcMain.handle('devtools:get-state', async () => {
        if (mainWindow && !mainWindow.isDestroyed()) {
            return mainWindow.webContents.isDevToolsOpened();
        }
        return false;
    });

    // Log: Get path
    ipcMain.handle('log:get-path', () => {
        return getLogFilePath();
    });

    // Console: Log message (from renderer)
    ipcMain.on('console:log', (_event, level: string, ...args: any[]) => {
        const message = args.map(arg => 
            typeof arg === 'object' ? JSON.stringify(arg) : String(arg)
        ).join(' ');
        log(`[RENDERER ${level.toUpperCase()}] ${message}`);
    });

    // Dialog: External change
    ipcMain.handle('dialog:external-change', async (_event, fileName: string) => {
        const result = await dialog.showMessageBox(mainWindow!, {
            type: 'question',
            buttons: ['Reload', 'Keep Current'],
            defaultId: 0,
            title: 'File Changed',
            message: `"${fileName}" has been modified externally.`,
            detail: 'Do you want to reload the file or keep your current version?',
        });

        return result.response === 0 ? 'reload' : 'keep';
    });

    // Window: Set title
    ipcMain.handle('window:set-title', async (_event, title: string) => {
        mainWindow?.setTitle(title);
    });

    // Window: Get bounds
    ipcMain.handle('window:get-bounds', async () => {
        return mainWindow?.getBounds();
    });

    // Window: Minimize
    ipcMain.handle('window:minimize', async () => {
        mainWindow?.minimize();
    });

    // Window: Maximize/Unmaximize
    ipcMain.handle('window:maximize', async () => {
        if (mainWindow?.isMaximized()) {
            mainWindow.unmaximize();
        } else {
            mainWindow?.maximize();
        }
    });

    // Window: Close
    ipcMain.handle('window:close', async () => {
        mainWindow?.close();
    });

    // Shell: Show in folder
    ipcMain.handle('shell:show-in-folder', async (_event, filePath: string) => {
        shell.showItemInFolder(filePath);
    });

    // File watching
    ipcMain.handle('file:watch', async (_event, filePath: string) => {
        watchFile(filePath);
    });

    ipcMain.handle('file:unwatch', async (_event, filePath: string) => {
        unwatchFile(filePath);
    });
}

function createWindow() {
    // Create the browser window with secure settings
    mainWindow = new BrowserWindow({
        width: 1200,
        height: 800,
        minWidth: 600,
        minHeight: 400,
        frame: false,
        icon: path.join(__dirname, 'assets', process.platform === 'win32' ? 'icon.ico' : 'MarkdownPlus.png'),
        webPreferences: {
            nodeIntegration: false,
            contextIsolation: true,
            preload: path.join(__dirname, 'preload.js'),
        },
    });

    // Load the index.html file
    mainWindow.loadFile(path.join(__dirname, 'index.html'));

    // Open the DevTools in development mode or if saved in config
    if (process.env.NODE_ENV === 'development') {
        log('Opening DevTools', { isDev: true });
        mainWindow.webContents.openDevTools();
    } else {
        // Check config for DevTools state
        loadConfig().then(config => {
            if (config.devToolsOpen && mainWindow && !mainWindow.isDestroyed()) {
                log('Opening DevTools from config', { devToolsOpen: config.devToolsOpen });
                mainWindow.webContents.openDevTools();
            }
        });
    }

    // Listen for DevTools open/close events (for native UI interactions)
    mainWindow.webContents.on('devtools-opened', async () => {
        log('DevTools opened via native UI');
        const config = await loadConfig();
        await saveConfig({ ...config, devToolsOpen: true });
    });

    mainWindow.webContents.on('devtools-closed', async () => {
        log('DevTools closed via native UI');
        const config = await loadConfig();
        await saveConfig({ ...config, devToolsOpen: false });
    });

    // Emitted when the window is closed
    mainWindow.on('closed', () => {
        // Dereference the window object
        mainWindow = null;
    });
}

// This method will be called when Electron has finished initialization
app.whenReady().then(async () => {
    // Initialize logger first
    initLogger();
    log('=== App Starting ===');
    log('Electron app ready');
    
    // Handle command line arguments (file associations) - MUST be done before creating window
    const args = process.argv.slice(1); // Skip the first argument (electron executable)
    log('Command line arguments received', { args, length: args.length });
    
    // Filter for markdown files (case-insensitive) and exclude flags
    pendingFilesToOpen = args.filter(arg => {
        const isMarkdown = isMarkdownFile(arg);
        const isNotFlag = !arg.startsWith('--') && !arg.startsWith('-');
        const result = isMarkdown && isNotFlag;
        log('Filtering argument', { arg, isMarkdown, isNotFlag, included: result });
        return result;
    });
    
    log('Pending files to open after filtering', { pendingFilesToOpen, count: pendingFilesToOpen.length });

    log('Registering IPC handlers');
    registerIpcHandlers();
    // Remove the native menu bar
    Menu.setApplicationMenu(null);
    log('Creating main window');
    createWindow();
    log('Main window created');
});

// Handle second instance (when user tries to open another file while app is running)
app.on('second-instance', (_event, commandLine) => {
    log('Second instance detected', { commandLine });
    
    // Focus the existing window
    if (mainWindow) {
        if (mainWindow.isMinimized()) mainWindow.restore();
        mainWindow.focus();
    }

    // Handle command line arguments from second instance
    const args = commandLine.slice(1); // Skip the first argument
    log('Second instance args', { args });
    
    const filesToOpen = args.filter(arg => {
        const isMarkdown = isMarkdownFile(arg);
        const isNotFlag = !arg.startsWith('--') && !arg.startsWith('-');
        return isMarkdown && isNotFlag;
    });
    
    log('Second instance files to open', { filesToOpen });

    if (filesToOpen.length > 0 && mainWindow && !mainWindow.isDestroyed()) {
        log('Sending second instance files to renderer', { filesToOpen });
        mainWindow.webContents.send('open-files-from-args', filesToOpen);
    }
});

// Prevent multiple instances
const gotTheLock = app.requestSingleInstanceLock();
if (!gotTheLock) {
    app.quit();
}

// Flush logs before quit
app.on('before-quit', async () => {
    log('App quitting, flushing logs');
    await flushLogsSync();
});
