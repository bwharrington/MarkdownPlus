import React, { useEffect } from 'react';
import { CssBaseline, Box, styled } from '@mui/material';
import { EditorProvider, useEditorState, useEditorDispatch, ThemeProvider } from './contexts';
import { Toolbar, TabBar, EditorPane, EmptyState, NotificationSnackbar } from './components';
import { useWindowTitle, useFileOperations } from './hooks';

// Intercept console methods and send to main process
const originalConsole = {
    log: console.log,
    warn: console.warn,
    error: console.error,
    info: console.info,
};

console.log = (...args: any[]) => {
    originalConsole.log(...args);
    window.electronAPI.sendConsoleLog('log', ...args);
};

console.warn = (...args: any[]) => {
    originalConsole.warn(...args);
    window.electronAPI.sendConsoleLog('warn', ...args);
};

console.error = (...args: any[]) => {
    originalConsole.error(...args);
    window.electronAPI.sendConsoleLog('error', ...args);
};

console.info = (...args: any[]) => {
    originalConsole.info(...args);
    window.electronAPI.sendConsoleLog('info', ...args);
};

const AppContainer = styled(Box)({
    display: 'flex',
    flexDirection: 'column',
    height: '100vh',
    overflow: 'hidden',
});

const MainContent = styled(Box)({
    display: 'flex',
    flex: 1,
    overflow: 'hidden',
});

// Inner app component that uses context
function AppContent() {
    const state = useEditorState();
    const dispatch = useEditorDispatch();
    const { saveFile, saveFileAs, saveAllFiles, openFile, closeFile, closeAllFiles, showInFolder, createNewFile } = useFileOperations();
    
    // Set up window title management
    useWindowTitle();

    // Set up keyboard shortcuts
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            // Ctrl+N - New File
            if (e.ctrlKey && e.key === 'n') {
                e.preventDefault();
                createNewFile();
                return;
            }

            // Ctrl+O - Open File
            if (e.ctrlKey && e.key === 'o') {
                e.preventDefault();
                openFile();
                return;
            }

            // Ctrl+S - Save File
            if (e.ctrlKey && e.key === 's') {
                e.preventDefault();
                saveFile();
                return;
            }

            // Ctrl+Shift+S - Save All Files
            if (e.ctrlKey && e.shiftKey && e.key === 'S') {
                e.preventDefault();
                saveAllFiles();
                return;
            }

            // Ctrl+W - Close File
            if (e.ctrlKey && e.key === 'w') {
                e.preventDefault();
                closeFile();
                return;
            }

            // Ctrl+E - Toggle Edit/Preview Mode
            if (e.ctrlKey && e.key === 'e' && state.activeFileId) {
                e.preventDefault();
                const activeFile = state.openFiles.find(f => f.id === state.activeFileId);
                if (activeFile) {
                    // Get current scroll position before toggling
                    const element = activeFile.viewMode === 'edit' 
                        ? document.querySelector('textarea') as HTMLTextAreaElement
                        : document.querySelector('[class*="MarkdownPreview"]') as HTMLDivElement;
                    const scrollPosition = element?.scrollTop || 0;
                    
                    dispatch({ 
                        type: 'TOGGLE_VIEW_MODE', 
                        payload: { id: state.activeFileId, scrollPosition } 
                    });
                }
                return;
            }
        };

        window.addEventListener('keydown', handleKeyDown);

        return () => {
            window.removeEventListener('keydown', handleKeyDown);
        };
    }, [createNewFile, openFile, saveFile, saveAllFiles, closeFile, state.activeFileId, state.openFiles, dispatch]);

    // Set up menu event listeners
    useEffect(() => {
        const cleanups: (() => void)[] = [];

        cleanups.push(window.electronAPI.onMenuSave(() => {
            saveFile();
        }));

        cleanups.push(window.electronAPI.onMenuSaveAs(() => {
            saveFileAs();
        }));

        cleanups.push(window.electronAPI.onMenuSaveAll(() => {
            saveAllFiles();
        }));

        cleanups.push(window.electronAPI.onMenuClose(() => {
            closeFile();
        }));

        cleanups.push(window.electronAPI.onMenuCloseAll(() => {
            closeAllFiles();
        }));

        cleanups.push(window.electronAPI.onMenuShowInFolder(() => {
            showInFolder();
        }));

        return () => {
            cleanups.forEach(cleanup => cleanup());
        };
    }, [saveFile, saveFileAs, saveAllFiles, closeFile, closeAllFiles, showInFolder]);

    // Handle external file changes (for real-time config updates)
    useEffect(() => {
        const cleanup = window.electronAPI.onExternalFileChange(async (filePath) => {
            console.log('[App] External file change detected:', filePath);
            
            // Find if this file is open
            const openFile = state.openFiles.find(f => f.path === filePath);
            if (!openFile) {
                return;
            }

            // For config file, automatically reload without prompting
            if (filePath.endsWith('config.json')) {
                console.log('[App] Auto-reloading config file');
                const fileData = await window.electronAPI.readFile(filePath);
                if (fileData) {
                    dispatch({
                        type: 'UPDATE_FILE_CONTENT',
                        payload: {
                            id: openFile.id,
                            content: fileData.content,
                            lineEnding: fileData.lineEnding,
                        },
                    });
                }
            } else {
                // For other files, only reload if not dirty
                if (!openFile.isDirty) {
                    console.log('[App] Auto-reloading clean file');
                    const fileData = await window.electronAPI.readFile(filePath);
                    if (fileData) {
                        dispatch({
                            type: 'UPDATE_FILE_CONTENT',
                            payload: {
                                id: openFile.id,
                                content: fileData.content,
                                lineEnding: fileData.lineEnding,
                            },
                        });
                    }
                }
            }
        });

        return cleanup;
    }, [state.openFiles, dispatch]);

    // Set up file opening from command line arguments (file associations)
    useEffect(() => {
        console.log('[App] Setting up file opening from command line');
        let hasReceivedInitialFiles = false;
        
        // Helper to extract filename from path (works on both Windows and Unix paths)
        const getFilename = (filePath: string) => {
            return filePath.split(/[\\/]/).pop() || filePath;
        };
        
        // Supported file extensions for checking unsupported formats
        const MARKDOWN_EXTENSIONS = ['.md', '.markdown', '.mdown', '.mkd', '.mkdn', '.mdx', '.mdwn'];
        const TEXT_EXTENSIONS = ['.txt'];
        
        const isUnsupportedFormat = (filePath: string): boolean => {
            const lowerPath = filePath.toLowerCase();
            const isMarkdown = MARKDOWN_EXTENSIONS.some(ext => lowerPath.endsWith(ext));
            const isText = TEXT_EXTENSIONS.some(ext => lowerPath.endsWith(ext));
            return !isMarkdown && !isText;
        };
        
        // Helper to open files
        const openFilesFromPaths = async (filePaths: string[]) => {
            console.log('[App] Opening files from paths:', filePaths);
            const unsupportedFiles: string[] = [];
            
            for (const filePath of filePaths) {
                try {
                    console.log('[App] Reading file:', filePath);
                    const fileData = await window.electronAPI.readFile(filePath);
                    console.log('[App] File data received:', { path: fileData?.filePath, contentLength: fileData?.content?.length });
                    if (fileData) {
                        // Track unsupported files
                        if (isUnsupportedFormat(fileData.filePath)) {
                            unsupportedFiles.push(getFilename(fileData.filePath));
                        }
                        const fileId = `file-${Date.now()}-${Math.random().toString(36).substring(2, 11)}`;
                        const fileName = getFilename(fileData.filePath);
                        console.log('[App] Dispatching OPEN_FILE action', { fileId, path: fileData.filePath, name: fileName });
                        dispatch({
                            type: 'OPEN_FILE',
                            payload: {
                                id: fileId,
                                path: fileData.filePath,
                                name: fileName,
                                content: fileData.content,
                                lineEnding: fileData.lineEnding,
                            },
                        });
                        console.log('[App] File opened successfully, dispatched OPEN_FILE');
                    } else {
                        console.warn('[App] File data is null/undefined');
                    }
                } catch (error) {
                    console.error('[App] Failed to open file from args:', error);
                }
            }
            
            // Show notification for unsupported files
            if (unsupportedFiles.length > 0) {
                dispatch({
                    type: 'SHOW_NOTIFICATION',
                    payload: {
                        message: unsupportedFiles.length === 1 
                            ? `"${unsupportedFiles[0]}" may not fully support Markdown preview.`
                            : `${unsupportedFiles.length} files may not fully support Markdown preview.`,
                        severity: 'warning',
                    },
                });
            }
        };

        // Listen for files from main process (this is the primary method)
        console.log('[App] Setting up onOpenFilesFromArgs listener');
        const cleanup = window.electronAPI.onOpenFilesFromArgs(async (filePaths: string[]) => {
            console.log('[App] *** Received files from main process via IPC event ***:', filePaths);
            hasReceivedInitialFiles = true;
            await openFilesFromPaths(filePaths);
        });

        // Signal to main process that renderer is ready and request initial files
        const loadInitialFiles = async () => {
            console.log('[App] Signaling renderer ready to main process');
            const filePaths = await window.electronAPI.rendererReady();
            console.log('[App] Renderer ready response - initial files:', filePaths);
            
            // If there are files from command line, open them
            if (filePaths && filePaths.length > 0) {
                console.log('[App] Opening files from renderer-ready response...');
                hasReceivedInitialFiles = true;
                await openFilesFromPaths(filePaths);
            } else {
                console.log('[App] No command line files from renderer-ready, checking via getInitialFiles...');
                
                // Fallback: also try getInitialFiles
                const fallbackFiles = await window.electronAPI.getInitialFiles();
                console.log('[App] getInitialFiles response:', fallbackFiles);
                
                if (fallbackFiles && fallbackFiles.length > 0) {
                    console.log('[App] Opening files from getInitialFiles...');
                    await openFilesFromPaths(fallbackFiles);
                } else {
                    console.log('[App] No command line files, restoring recent files from config...');
                    // No command line files, restore recent files from config
                    try {
                        const config = await window.electronAPI.loadConfig();
                        console.log('[App] Config loaded', { openFilesCount: config.openFiles.length });
                        for (const filePath of config.openFiles) {
                            // Skip config.json - it should only be opened manually via Settings
                            if (filePath.endsWith('config.json')) {
                                console.log('[App] Skipping config.json');
                                continue;
                            }
                            try {
                                console.log('[App] Restoring recent file:', filePath);
                                const result = await window.electronAPI.readFile(filePath);
                                if (result) {
                                    dispatch({
                                        type: 'OPEN_FILE',
                                        payload: {
                                            id: `file-${Date.now()}-${Math.random().toString(36).substring(2, 11)}`,
                                            path: result.filePath,
                                            name: getFilename(result.filePath),
                                            content: result.content,
                                            lineEnding: result.lineEnding,
                                        },
                                    });
                                    console.log('[App] Recent file restored:', filePath);
                                }
                            } catch (error) {
                                console.warn('[App] Failed to restore recent file:', filePath, error);
                                // Silently skip files that can't be opened
                            }
                        }
                    } catch (error) {
                        console.error('[App] Failed to load recent files:', error);
                    }
                }
            }
        };
        
        console.log('[App] Calling loadInitialFiles...');
        loadInitialFiles();

        return cleanup;
    }, [dispatch]);

    const hasOpenFiles = state.openFiles.length > 0;

    return (
        <AppContainer>
            <Toolbar />
            <TabBar />
            <MainContent>
                {hasOpenFiles ? <EditorPane /> : <EmptyState />}
            </MainContent>
            <NotificationSnackbar />
        </AppContainer>
    );
}

const App: React.FC = () => {
    return (
        <ThemeProvider>
            <CssBaseline />
            <EditorProvider>
                <AppContent />
            </EditorProvider>
        </ThemeProvider>
    );
};

export default App;
