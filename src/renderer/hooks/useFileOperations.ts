import { useCallback, useRef } from 'react';
import { useEditorState, useEditorDispatch, useActiveFile } from '../contexts';
import type { IConfig } from '../types';
import { getFileType } from '../utils/fileHelpers';

export { getFileType };

// Generate unique ID
const generateId = () => Math.random().toString(36).substring(2, 11);

export function useFileOperations() {
    const state = useEditorState();
    const dispatch = useEditorDispatch();
    const activeFile = useActiveFile();

    const openFilesRef = useRef(state.openFiles);
    openFilesRef.current = state.openFiles;

    const configRef = useRef(state.config);
    configRef.current = state.config;

    const activeFileRef = useRef(activeFile);
    activeFileRef.current = activeFile;

    const saveConfigAndUpdateEditor = useCallback(async (newConfig: IConfig) => {
        dispatch({ type: 'SET_CONFIG', payload: newConfig });
        await window.electronAPI.saveConfig(newConfig);

        const configFile = openFilesRef.current.find(f => f.path?.endsWith('config.json'));
        if (configFile) {
            const updatedContent = JSON.stringify(newConfig, null, 2);
            dispatch({
                type: 'UPDATE_CONTENT',
                payload: { id: configFile.id, content: updatedContent },
            });
            dispatch({
                type: 'SET_DIRTY',
                payload: { id: configFile.id, isDirty: false },
            });
        }
    }, [dispatch]);

    const createNewFile = useCallback(() => {
        dispatch({ type: 'NEW_FILE' });
    }, [dispatch]);

    const openFile = useCallback(async () => {
        const results = await window.electronAPI.openFile();
        if (results && results.length > 0) {
            const openedFilePaths: string[] = [];
            const unsupportedFiles: string[] = [];

            for (const result of results) {
                if (openFilesRef.current.some(f => f.path === result.filePath)) {
                    openedFilePaths.push(result.filePath);
                    continue;
                }

                const fileType = getFileType(result.filePath);
                if (fileType === 'unknown') {
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
                        fileType: fileType,
                    },
                });
                openedFilePaths.push(result.filePath);
            }

            if (unsupportedFiles.length > 0) {
                dispatch({
                    type: 'SHOW_NOTIFICATION',
                    payload: {
                        message: unsupportedFiles.length === 1
                            ? `"${unsupportedFiles[0]}" may not fully support preview.`
                            : `${unsupportedFiles.length} files may not fully support preview.`,
                        severity: 'warning',
                    },
                });
            }

            const allOpenFileRefs = [
                ...openFilesRef.current
                    .filter(f => f.path !== null && !f.path.endsWith('config.json'))
                    .map(f => ({ fileName: f.path!, mode: f.viewMode })),
                ...openedFilePaths.map(p => ({ fileName: p, mode: 'edit' as const }))
            ];
            const uniqueOpenFiles = allOpenFileRefs.filter((ref, index, self) =>
                index === self.findIndex(r => r.fileName === ref.fileName)
            );

            const newRecentFiles = [
                ...openedFilePaths.map(p => ({ fileName: p, mode: 'edit' as const })),
                ...configRef.current.recentFiles.filter(ref => !openedFilePaths.includes(ref.fileName)),
            ].slice(0, 10);

            const newConfig: IConfig = {
                ...configRef.current,
                recentFiles: newRecentFiles,
                openFiles: uniqueOpenFiles,
            };
            void saveConfigAndUpdateEditor(newConfig);
        }
    }, [dispatch, saveConfigAndUpdateEditor]);

    const openRecentFile = useCallback(async (filePath: string) => {
        const result = await window.electronAPI.readFile(filePath);
        if (result) {
            const fileType = getFileType(result.filePath);
            if (fileType === 'unknown') {
                const fileName = result.filePath.split(/[\\/]/).pop() || 'Unknown';
                dispatch({
                    type: 'SHOW_NOTIFICATION',
                    payload: {
                        message: `"${fileName}" may not fully support preview.`,
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
                    fileType: fileType,
                    viewMode: fileType === 'text' ? 'edit' : undefined,
                },
            });

            const openFileRefs = [
                ...openFilesRef.current
                    .filter(f => f.path !== null && !f.path.endsWith('config.json'))
                    .map(f => ({ fileName: f.path!, mode: f.viewMode })),
                { fileName: result.filePath, mode: 'edit' as const }
            ];
            const uniqueOpenFiles = openFileRefs.filter((ref, index, self) =>
                index === self.findIndex(r => r.fileName === ref.fileName)
            );

            const newConfig: IConfig = {
                ...configRef.current,
                openFiles: uniqueOpenFiles,
            };
            void saveConfigAndUpdateEditor(newConfig);
        } else {
            dispatch({
                type: 'SHOW_NOTIFICATION',
                payload: {
                    message: `Could not open "${filePath.split(/[\\/]/).pop()}"`,
                    severity: 'error',
                },
            });
        }
    }, [dispatch, saveConfigAndUpdateEditor]);

    const saveFileAs = useCallback(async (fileId?: string) => {
        const file = fileId
            ? openFilesRef.current.find(f => f.id === fileId)
            : activeFileRef.current;

        if (!file) return false;

        if (file.path !== null) {
            await window.electronAPI.unwatchFile(file.path);
        }

        const result = await window.electronAPI.saveFileAs(file.content, file.name);
        if (result && result.success) {
            const newName = result.filePath.split(/[\\/]/).pop() || file.name;

            await window.electronAPI.watchFile(result.filePath);

            dispatch({
                type: 'UPDATE_FILE_PATH',
                payload: { id: file.id, path: result.filePath, name: newName },
            });
            dispatch({
                type: 'SHOW_NOTIFICATION',
                payload: { message: `Saved "${newName}"`, severity: 'success' },
            });

            const openFileRefs = openFilesRef.current
                .filter(f => (f.id === file.id ? result.filePath : f.path) !== null && !(f.id === file.id ? result.filePath : f.path)!.endsWith('config.json'))
                .map(f => ({
                    fileName: f.id === file.id ? result.filePath : f.path!,
                    mode: f.viewMode,
                }));

            const newConfig: IConfig = {
                ...configRef.current,
                openFiles: openFileRefs,
                recentFiles: [
                    { fileName: result.filePath, mode: file.viewMode },
                    ...configRef.current.recentFiles.filter(ref => ref.fileName !== result.filePath),
                ].slice(0, 10),
            };
            await saveConfigAndUpdateEditor(newConfig);

            return true;
        } else {
            if (file.path !== null) {
                await window.electronAPI.watchFile(file.path);
            }
            return false;
        }
    }, [dispatch, saveConfigAndUpdateEditor]);

    const saveFile = useCallback(async (fileId?: string) => {
        const file = fileId
            ? openFilesRef.current.find(f => f.id === fileId)
            : activeFileRef.current;

        if (!file) return false;

        if (file.path === null) {
            return saveFileAs(file.id);
        }

        if (file.pendingExternalPath) {
            const choice = await window.electronAPI.confirmOverwriteExternal(file.name);
            if (choice === 'cancel') return false;
        }

        await window.electronAPI.unwatchFile(file.path);

        const result = await window.electronAPI.saveFile(file.path, file.content);

        await window.electronAPI.watchFile(file.path);

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
    }, [dispatch, saveFileAs]);

    const saveAllFiles = useCallback(async () => {
        const dirtyFiles = openFilesRef.current.filter(f => f.isDirty);
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
    }, [dispatch, saveFile]);

    const closeFile = useCallback(async (fileId?: string) => {
        const file = fileId
            ? openFilesRef.current.find(f => f.id === fileId)
            : activeFileRef.current;

        if (!file) return;

        console.log('[useFileOperations] closeFile called', { fileId: file.id, fileName: file.name, isDirty: file.isDirty });

        try {
            if (file.isDirty) {
                const result = await window.electronAPI.confirmClose(file.name);
                console.log('[useFileOperations] confirmClose result', { fileId: file.id, action: result.action });

                if (result.action === 'cancel') {
                    console.log('[useFileOperations] closeFile cancelled by user', { fileId: file.id });
                    return;
                }

                if (result.action === 'save') {
                    const saved = await saveFile(file.id);
                    if (!saved) {
                        console.warn('[useFileOperations] Save failed during close, aborting close', { fileId: file.id });
                        return;
                    }
                }
            }

            dispatch({ type: 'CLOSE_FILE', payload: { id: file.id } });
            console.log('[useFileOperations] CLOSE_FILE dispatched', { fileId: file.id });

            const openFileRefs = openFilesRef.current
                .filter(f => f.id !== file.id && f.path !== null && !f.path.endsWith('config.json'))
                .map(f => ({ fileName: f.path!, mode: f.viewMode }));

            const newConfig: IConfig = {
                ...configRef.current,
                openFiles: openFileRefs,
            };
            await saveConfigAndUpdateEditor(newConfig);
            console.log('[useFileOperations] closeFile complete', { fileId: file.id });
        } catch (error) {
            console.error('[useFileOperations] closeFile error', {
                fileId: file.id,
                fileName: file.name,
                error: error instanceof Error ? error.message : String(error),
                stack: error instanceof Error ? error.stack : undefined,
            });
            dispatch({
                type: 'SHOW_NOTIFICATION',
                payload: {
                    message: `Failed to close "${file.name}". Please try again.`,
                    severity: 'error',
                },
            });
        }
    }, [dispatch, saveFile, saveConfigAndUpdateEditor]);

    const closeAllFiles = useCallback(async () => {
        const dirtyFiles = openFilesRef.current.filter(f => f.isDirty);

        if (dirtyFiles.length > 0) {
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

        for (const file of [...openFilesRef.current]) {
            dispatch({ type: 'CLOSE_FILE', payload: { id: file.id } });
        }

        const newConfig: IConfig = {
            ...configRef.current,
            openFiles: [],
        };
        await saveConfigAndUpdateEditor(newConfig);

        return true;
    }, [dispatch, saveFile, saveConfigAndUpdateEditor]);

    const showInFolder = useCallback(async () => {
        if (activeFileRef.current?.path) {
            await window.electronAPI.showInFolder(activeFileRef.current.path);
        }
    }, []);

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
        const recentFileRefs = configRef.current.recentFiles.filter(ref => !ref.fileName.endsWith('config.json'));
        const openedFileRefs: { fileName: string; mode: 'edit' | 'preview' }[] = [];

        for (const fileRef of recentFileRefs) {
            if (openFilesRef.current.some(f => f.path === fileRef.fileName)) {
                const existingFile = openFilesRef.current.find(f => f.path === fileRef.fileName);
                if (existingFile) {
                    openedFileRefs.push({ fileName: fileRef.fileName, mode: existingFile.viewMode as 'edit' | 'preview' });
                }
                continue;
            }
            const result = await window.electronAPI.readFile(fileRef.fileName);
            if (result) {
                const fileType = getFileType(result.filePath);
                dispatch({
                    type: 'OPEN_FILE',
                    payload: {
                        id: generateId(),
                        path: result.filePath,
                        name: result.filePath.split(/[\\/]/).pop() || 'Unknown',
                        content: result.content,
                        lineEnding: result.lineEnding,
                        viewMode: fileRef.mode as 'edit' | 'preview',
                        fileType: fileType,
                    },
                });
                openedFileRefs.push({ fileName: result.filePath, mode: fileRef.mode as 'edit' | 'preview' });
            }
        }

        if (openedFileRefs.length > 0) {
            const allOpenFileRefs = [
                ...openFilesRef.current
                    .filter(f => f.path !== null && !f.path.endsWith('config.json'))
                    .map(f => ({ fileName: f.path!, mode: f.viewMode })),
                ...openedFileRefs
            ];
            const uniqueOpenFiles = allOpenFileRefs.filter((ref, index, self) =>
                index === self.findIndex(r => r.fileName === ref.fileName)
            );

            const newConfig: IConfig = {
                ...configRef.current,
                openFiles: uniqueOpenFiles,
            };
            void saveConfigAndUpdateEditor(newConfig);
        }
    }, [dispatch, saveConfigAndUpdateEditor]);

    const renameFile = useCallback(async (fileId: string, newName: string) => {
        const file = openFilesRef.current.find(f => f.id === fileId);
        if (!file || !file.path) {
            dispatch({
                type: 'SHOW_NOTIFICATION',
                payload: { message: 'Cannot rename unsaved file', severity: 'warning' },
            });
            return false;
        }

        const oldExt = file.name.includes('.') ? file.name.substring(file.name.lastIndexOf('.')) : '';
        const newNameWithExt = newName.includes('.') ? newName : newName + oldExt;

        const directory = file.path.substring(0, file.path.lastIndexOf('\\') !== -1 ? file.path.lastIndexOf('\\') : file.path.lastIndexOf('/'));
        const separator = file.path.includes('\\') ? '\\' : '/';
        const newPath = directory + separator + newNameWithExt;

        try {
            if (file.isDirty) {
                const saved = await saveFile(fileId);
                if (!saved) {
                    return false;
                }
            }

            await window.electronAPI.renameFile(file.path, newPath);

            dispatch({
                type: 'UPDATE_FILE_PATH',
                payload: { id: fileId, path: newPath, name: newNameWithExt },
            });

            const openFileRefs = openFilesRef.current
                .filter(f => (f.id === fileId ? newPath : f.path) !== null && !(f.id === fileId ? newPath : f.path)!.endsWith('config.json'))
                .map(f => ({
                    fileName: f.id === fileId ? newPath : f.path!,
                    mode: f.viewMode,
                }));

            const newConfig: IConfig = {
                ...configRef.current,
                openFiles: openFileRefs,
                recentFiles: configRef.current.recentFiles.map(ref =>
                    ref.fileName === file.path ? { ...ref, fileName: newPath } : ref
                ),
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
    }, [dispatch, saveFile, saveConfigAndUpdateEditor]);

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
