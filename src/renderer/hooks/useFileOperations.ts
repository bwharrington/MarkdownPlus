import { useCallback } from 'react';
import { useEditorState, useEditorDispatch, useActiveFile } from '../contexts';
import type { IConfig } from '../types';

// Generate unique ID
const generateId = () => Math.random().toString(36).substring(2, 11);

// Supported file extensions
const MARKDOWN_EXTENSIONS = ['.md', '.markdown', '.mdown', '.mkd', '.mkdn', '.mdx', '.mdwn'];
const TEXT_EXTENSIONS = ['.txt'];
const BEST_EFFORT_EXTENSIONS = ['.rst', '.adoc', '.asciidoc', '.org', '.textile'];

// Check file type
function getFileType(filePath: string): 'markdown' | 'text' | 'best-effort' | 'unknown' {
    const lowerPath = filePath.toLowerCase();
    if (MARKDOWN_EXTENSIONS.some(ext => lowerPath.endsWith(ext))) return 'markdown';
    if (TEXT_EXTENSIONS.some(ext => lowerPath.endsWith(ext))) return 'text';
    if (BEST_EFFORT_EXTENSIONS.some(ext => lowerPath.endsWith(ext))) return 'best-effort';
    return 'unknown';
}

export function useFileOperations() {
    const state = useEditorState();
    const dispatch = useEditorDispatch();
    const activeFile = useActiveFile();

    // Helper function to save config and update the config file if it's open in the editor
    const saveConfigAndUpdateEditor = useCallback(async (newConfig: IConfig) => {
        dispatch({ type: 'SET_CONFIG', payload: newConfig });
        await window.electronAPI.saveConfig(newConfig);
        
        // Find if config.json is currently open in the editor
        const configFile = state.openFiles.find(f => f.path?.endsWith('config.json'));
        if (configFile) {
            // Update the config file's content in the editor
            const updatedContent = JSON.stringify(newConfig, null, 2);
            dispatch({
                type: 'UPDATE_CONTENT',
                payload: { id: configFile.id, content: updatedContent },
            });
            // Reset dirty flag since we just saved it
            dispatch({
                type: 'SET_DIRTY',
                payload: { id: configFile.id, isDirty: false },
            });
        }
    }, [dispatch, state.openFiles]);

    const createNewFile = useCallback(() => {
        dispatch({ type: 'NEW_FILE' });
    }, [dispatch]);

    const openFile = useCallback(async () => {
        const results = await window.electronAPI.openFile();
        if (results && results.length > 0) {
            const openedFilePaths: string[] = [];
            const unsupportedFiles: string[] = [];
            
            // Open each file
            for (const result of results) {
                // Skip if file is already open
                if (state.openFiles.some(f => f.path === result.filePath)) {
                    openedFilePaths.push(result.filePath);
                    continue;
                }
                
                // Check file type and track unsupported formats
                const fileType = getFileType(result.filePath);
                if (fileType === 'best-effort' || fileType === 'unknown') {
                    const fileName = result.filePath.split(/[\\/]/).pop() || 'Unknown';
                    unsupportedFiles.push(fileName);
                }
                
                dispatch({
                    type: 'OPEN_FILE',
                    payload: {
                        id: generateId(),
                        path: result.filePath,
                        name: result.filePath.split(/[\\/]/).pop() || 'Unknown',
                        content: result.content,
                        lineEnding: result.lineEnding,
                    },
                });
                openedFilePaths.push(result.filePath);
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

            // Update recent files and open files in config
            const allOpenFiles = [
                ...state.openFiles.map(f => f.path).filter((p): p is string => p !== null && !p.endsWith('config.json')),
                ...openedFilePaths
            ];
            const uniqueOpenFiles = Array.from(new Set(allOpenFiles));
            
            const newRecentFiles = [
                ...openedFilePaths,
                ...state.config.recentFiles.filter(f => !openedFilePaths.includes(f)),
            ].slice(0, 10);

            const newConfig: IConfig = {
                ...state.config,
                recentFiles: newRecentFiles,
                openFiles: uniqueOpenFiles,
            };
            await saveConfigAndUpdateEditor(newConfig);
        }
    }, [dispatch, state.config, state.openFiles, saveConfigAndUpdateEditor]);

    const openRecentFile = useCallback(async (filePath: string) => {
        const result = await window.electronAPI.readFile(filePath);
        if (result) {
            // Check file type and show notification for unsupported formats
            const fileType = getFileType(result.filePath);
            if (fileType === 'best-effort' || fileType === 'unknown') {
                const fileName = result.filePath.split(/[\\/]/).pop() || 'Unknown';
                dispatch({
                    type: 'SHOW_NOTIFICATION',
                    payload: {
                        message: `"${fileName}" may not fully support Markdown preview.`,
                        severity: 'warning',
                    },
                });
            }
            
            dispatch({
                type: 'OPEN_FILE',
                payload: {
                    id: generateId(),
                    path: result.filePath,
                    name: result.filePath.split(/[\\/]/).pop() || 'Unknown',
                    content: result.content,
                    lineEnding: result.lineEnding,
                },
            });
            
            // Update openFiles in config
            const openFilePaths = [
                ...state.openFiles.map(f => f.path).filter((p): p is string => p !== null && !p.endsWith('config.json')),
                result.filePath
            ];
            // Remove duplicates
            const uniqueOpenFiles = Array.from(new Set(openFilePaths));
            
            const newConfig: IConfig = {
                ...state.config,
                openFiles: uniqueOpenFiles,
            };
            await saveConfigAndUpdateEditor(newConfig);
        } else {
            dispatch({
                type: 'SHOW_NOTIFICATION',
                payload: {
                    message: `Could not open "${filePath.split(/[\\/]/).pop()}"`,
                    severity: 'error',
                },
            });
        }
    }, [dispatch, state.config, state.openFiles, saveConfigAndUpdateEditor]);

    const saveFile = useCallback(async (fileId?: string) => {
        const file = fileId 
            ? state.openFiles.find(f => f.id === fileId)
            : activeFile;
        
        if (!file) return false;

        if (file.path === null) {
            // Untitled file - use Save As
            return saveFileAs(file.id);
        }

        const result = await window.electronAPI.saveFile(file.path, file.content);
        if (result.success) {
            dispatch({ type: 'SET_DIRTY', payload: { id: file.id, isDirty: false } });
            dispatch({
                type: 'SHOW_NOTIFICATION',
                payload: { message: `Saved "${file.name}"`, severity: 'success' },
            });
            return true;
        } else {
            dispatch({
                type: 'SHOW_NOTIFICATION',
                payload: { message: `Failed to save "${file.name}"`, severity: 'error' },
            });
            return false;
        }
    }, [activeFile, state.openFiles, dispatch]);

    const saveFileAs = useCallback(async (fileId?: string) => {
        const file = fileId 
            ? state.openFiles.find(f => f.id === fileId)
            : activeFile;
        
        if (!file) return false;

        const result = await window.electronAPI.saveFileAs(file.content, file.name);
        if (result && result.success) {
            const newName = result.filePath.split(/[\\/]/).pop() || file.name;
            dispatch({
                type: 'UPDATE_FILE_PATH',
                payload: { id: file.id, path: result.filePath, name: newName },
            });
            dispatch({
                type: 'SHOW_NOTIFICATION',
                payload: { message: `Saved "${newName}"`, severity: 'success' },
            });

            // Update config with new open files (exclude config.json)
            const openFilePaths = state.openFiles
                .map(f => f.id === file.id ? result.filePath : f.path)
                .filter((p): p is string => p !== null && !p.endsWith('config.json'));
            
            const newConfig: IConfig = {
                ...state.config,
                openFiles: openFilePaths,
                recentFiles: [
                    result.filePath,
                    ...state.config.recentFiles.filter(f => f !== result.filePath),
                ].slice(0, 10),
            };
            await saveConfigAndUpdateEditor(newConfig);

            return true;
        }
        return false;
    }, [activeFile, state.openFiles, state.config, dispatch]);

    const saveAllFiles = useCallback(async () => {
        const dirtyFiles = state.openFiles.filter(f => f.isDirty);
        let allSaved = true;

        for (const file of dirtyFiles) {
            const success = await saveFile(file.id);
            if (!success) allSaved = false;
        }

        if (allSaved && dirtyFiles.length > 0) {
            dispatch({
                type: 'SHOW_NOTIFICATION',
                payload: { message: `Saved ${dirtyFiles.length} file(s)`, severity: 'success' },
            });
        }

        return allSaved;
    }, [state.openFiles, saveFile, dispatch]);

    const closeFile = useCallback(async (fileId?: string) => {
        const file = fileId 
            ? state.openFiles.find(f => f.id === fileId)
            : activeFile;
        
        if (!file) return;

        if (file.isDirty) {
            const result = await window.electronAPI.confirmClose(file.name);
            
            if (result.action === 'cancel') {
                return;
            }
            
            if (result.action === 'save') {
                const saved = await saveFile(file.id);
                if (!saved) return;
            }
        }

        dispatch({ type: 'CLOSE_FILE', payload: { id: file.id } });

        // Update config (exclude config.json from openFiles)
        const openFilePaths = state.openFiles
            .filter(f => f.id !== file.id && f.path !== null && !f.path.endsWith('config.json'))
            .map(f => f.path as string);
        
        const newConfig: IConfig = {
            ...state.config,
            openFiles: openFilePaths,
        };
        await saveConfigAndUpdateEditor(newConfig);
    }, [activeFile, state.openFiles, state.config, dispatch, saveFile, saveConfigAndUpdateEditor]);

    const closeAllFiles = useCallback(async () => {
        const dirtyFiles = state.openFiles.filter(f => f.isDirty);
        
        if (dirtyFiles.length > 0) {
            // Ask to save all dirty files
            for (const file of dirtyFiles) {
                const result = await window.electronAPI.confirmClose(file.name);
                
                if (result.action === 'cancel') {
                    return false;
                }
                
                if (result.action === 'save') {
                    const saved = await saveFile(file.id);
                    if (!saved) return false;
                }
            }
        }

        // Close all files
        for (const file of [...state.openFiles]) {
            dispatch({ type: 'CLOSE_FILE', payload: { id: file.id } });
        }

        // Update config
        const newConfig: IConfig = {
            ...state.config,
            openFiles: [],
        };
        await saveConfigAndUpdateEditor(newConfig);

        return true;
    }, [state.openFiles, state.config, dispatch, saveFile, saveConfigAndUpdateEditor]);

    const showInFolder = useCallback(async () => {
        if (activeFile?.path) {
            await window.electronAPI.showInFolder(activeFile.path);
        }
    }, [activeFile]);

    const openConfigFile = useCallback(async () => {
        const result = await window.electronAPI.openConfig();
        if (result) {
            dispatch({
                type: 'OPEN_FILE',
                payload: {
                    id: generateId(),
                    path: result.filePath,
                    name: result.filePath.split(/[\\/]/).pop() || 'config.json',
                    content: result.content,
                    lineEnding: result.lineEnding,
                },
            });
        }
    }, [dispatch]);

    const openAllRecentFiles = useCallback(async () => {
        const recentFiles = state.config.recentFiles.filter(f => !f.endsWith('config.json'));
        const openedFilePaths: string[] = [];
        
        for (const filePath of recentFiles) {
            // Skip if file is already open
            if (state.openFiles.some(f => f.path === filePath)) {
                openedFilePaths.push(filePath);
                continue;
            }
            const result = await window.electronAPI.readFile(filePath);
            if (result) {
                dispatch({
                    type: 'OPEN_FILE',
                    payload: {
                        id: generateId(),
                        path: result.filePath,
                        name: result.filePath.split(/[\\/]/).pop() || 'Unknown',
                        content: result.content,
                        lineEnding: result.lineEnding,
                    },
                });
                openedFilePaths.push(result.filePath);
            }
        }
        
        // Update config with all opened files
        if (openedFilePaths.length > 0) {
            const allOpenFiles = [
                ...state.openFiles.map(f => f.path).filter((p): p is string => p !== null && !p.endsWith('config.json')),
                ...openedFilePaths
            ];
            // Remove duplicates
            const uniqueOpenFiles = Array.from(new Set(allOpenFiles));
            
            const newConfig: IConfig = {
                ...state.config,
                openFiles: uniqueOpenFiles,
            };
            await saveConfigAndUpdateEditor(newConfig);
        }
    }, [dispatch, state.config, state.openFiles, saveConfigAndUpdateEditor]);

    const renameFile = useCallback(async (fileId: string, newName: string) => {
        const file = state.openFiles.find(f => f.id === fileId);
        if (!file || !file.path) {
            dispatch({
                type: 'SHOW_NOTIFICATION',
                payload: { message: 'Cannot rename unsaved file', severity: 'warning' },
            });
            return false;
        }

        // Ensure the new name has the same extension
        const oldExt = file.name.includes('.') ? file.name.substring(file.name.lastIndexOf('.')) : '';
        const newNameWithExt = newName.includes('.') ? newName : newName + oldExt;

        // Construct new path
        const directory = file.path.substring(0, file.path.lastIndexOf('\\') !== -1 ? file.path.lastIndexOf('\\') : file.path.lastIndexOf('/'));
        const separator = file.path.includes('\\') ? '\\' : '/';
        const newPath = directory + separator + newNameWithExt;

        try {
            // Save file first if dirty
            if (file.isDirty) {
                const saved = await saveFile(fileId);
                if (!saved) {
                    return false;
                }
            }

            // Rename the file using the electron API
            await window.electronAPI.renameFile(file.path, newPath);

            // Update the file in state
            dispatch({
                type: 'UPDATE_FILE_PATH',
                payload: { id: fileId, path: newPath, name: newNameWithExt },
            });

            // Update config
            const openFilePaths = state.openFiles
                .map(f => f.id === fileId ? newPath : f.path)
                .filter((p): p is string => p !== null && !p.endsWith('config.json'));

            const newConfig: IConfig = {
                ...state.config,
                openFiles: openFilePaths,
                recentFiles: state.config.recentFiles.map(p => p === file.path ? newPath : p),
            };

            await saveConfigAndUpdateEditor(newConfig);

            dispatch({
                type: 'SHOW_NOTIFICATION',
                payload: { message: `Renamed to "${newNameWithExt}"`, severity: 'success' },
            });

            return true;
        } catch (error) {
            dispatch({
                type: 'SHOW_NOTIFICATION',
                payload: { message: `Failed to rename file`, severity: 'error' },
            });
            return false;
        }
    }, [state.openFiles, state.config, dispatch, saveFile, saveConfigAndUpdateEditor]);

    const hasDirtyFiles = state.openFiles.some(f => f.isDirty);

    return {
        createNewFile,
        openFile,
        openRecentFile,
        openAllRecentFiles,
        saveFile,
        saveFileAs,
        saveAllFiles,
        closeFile,
        closeAllFiles,
        showInFolder,
        openConfigFile,
        renameFile,
        hasDirtyFiles,
    };
}
