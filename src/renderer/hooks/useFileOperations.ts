import { useCallback } from 'react';
import { useEditorState, useEditorDispatch, useActiveFile } from '../contexts';
import type { IConfig } from '../types';

// Generate unique ID
const generateId = () => Math.random().toString(36).substring(2, 11);

export function useFileOperations() {
    const state = useEditorState();
    const dispatch = useEditorDispatch();
    const activeFile = useActiveFile();

    const createNewFile = useCallback(() => {
        dispatch({ type: 'NEW_FILE' });
    }, [dispatch]);

    const openFile = useCallback(async () => {
        const result = await window.electronAPI.openFile();
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

            // Update recent files in config
            const newRecentFiles = [
                result.filePath,
                ...state.config.recentFiles.filter(f => f !== result.filePath),
            ].slice(0, 10);

            const newConfig: IConfig = {
                ...state.config,
                recentFiles: newRecentFiles,
            };
            dispatch({ type: 'SET_CONFIG', payload: newConfig });
            await window.electronAPI.saveConfig(newConfig);
        }
    }, [dispatch, state.config]);

    const openRecentFile = useCallback(async (filePath: string) => {
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
        } else {
            dispatch({
                type: 'SHOW_NOTIFICATION',
                payload: {
                    message: `Could not open "${filePath.split(/[\\/]/).pop()}"`,
                    severity: 'error',
                },
            });
        }
    }, [dispatch]);

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

            // Update config with new open files
            const openFilePaths = state.openFiles
                .map(f => f.id === file.id ? result.filePath : f.path)
                .filter((p): p is string => p !== null);
            
            const newConfig: IConfig = {
                ...state.config,
                openFiles: openFilePaths,
                recentFiles: [
                    result.filePath,
                    ...state.config.recentFiles.filter(f => f !== result.filePath),
                ].slice(0, 10),
            };
            dispatch({ type: 'SET_CONFIG', payload: newConfig });
            await window.electronAPI.saveConfig(newConfig);

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

        // Update config
        const openFilePaths = state.openFiles
            .filter(f => f.id !== file.id && f.path !== null)
            .map(f => f.path as string);
        
        const newConfig: IConfig = {
            ...state.config,
            openFiles: openFilePaths,
        };
        dispatch({ type: 'SET_CONFIG', payload: newConfig });
        await window.electronAPI.saveConfig(newConfig);
    }, [activeFile, state.openFiles, state.config, dispatch, saveFile]);

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
        dispatch({ type: 'SET_CONFIG', payload: newConfig });
        await window.electronAPI.saveConfig(newConfig);

        return true;
    }, [state.openFiles, state.config, dispatch, saveFile]);

    const showInFolder = useCallback(async () => {
        if (activeFile?.path) {
            await window.electronAPI.showInFolder(activeFile.path);
        }
    }, [activeFile]);

    const hasDirtyFiles = state.openFiles.some(f => f.isDirty);

    return {
        createNewFile,
        openFile,
        openRecentFile,
        saveFile,
        saveFileAs,
        saveAllFiles,
        closeFile,
        closeAllFiles,
        showInFolder,
        hasDirtyFiles,
    };
}
