import { app, BrowserWindow, dialog, Menu, ipcMain, shell } from 'electron';
import * as path from 'path';
import * as fs from 'fs/promises';

let mainWindow: BrowserWindow | null;

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
    recentFiles: [],
    openFiles: [],
    defaultLineEnding: 'CRLF' as const,
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
        return { ...defaultConfig, ...JSON.parse(data) };
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

// Register IPC handlers
function registerIpcHandlers() {
    // File: Open dialog
    ipcMain.handle('file:open', async () => {
        const result = await dialog.showOpenDialog(mainWindow!, {
            filters: [
                { name: 'Markdown', extensions: ['md', 'markdown'] },
                { name: 'Text Files', extensions: ['txt'] },
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
        try {
            const content = await fs.readFile(filePath, 'utf-8');
            const lineEnding = detectLineEnding(content);
            return { filePath, content, lineEnding };
        } catch (error) {
            console.error('Failed to read file:', error);
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

    // Config: Sync recent files with open files
    ipcMain.handle('config:sync-recent-files', async (_event, openFiles: string[]) => {
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
}

function createWindow() {
    // Create the browser window with secure settings
    mainWindow = new BrowserWindow({
        width: 1200,
        height: 800,
        minWidth: 600,
        minHeight: 400,
        frame: false,
        icon: path.join(__dirname, 'assets', 'MarkdownPlus.png'),
        webPreferences: {
            nodeIntegration: false,
            contextIsolation: true,
            preload: path.join(__dirname, 'preload.js'),
        },
    });

    // Load the index.html file
    mainWindow.loadFile(path.join(__dirname, 'index.html'));

    // Open the DevTools in development mode
    if (process.env.NODE_ENV === 'development') {
        mainWindow.webContents.openDevTools();
    }

    // Emitted when the window is closed
    mainWindow.on('closed', () => {
        // Dereference the window object
        mainWindow = null;
    });
}

// This method will be called when Electron has finished initialization
app.whenReady().then(async () => {
    registerIpcHandlers();
    // Remove the native menu bar
    Menu.setApplicationMenu(null);
    createWindow();
});

// Quit when all windows are closed, except on macOS
app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        app.quit();
    }
});

app.on('activate', () => {
    // On macOS it's common to re-create a window when the dock icon is clicked
    if (mainWindow === null) {
        createWindow();
    }
});
