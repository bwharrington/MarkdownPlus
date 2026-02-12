import React, { createContext, useContext, useReducer, useEffect, ReactNode } from 'react';
import type { IFile, EditorState, Notification, IConfig, FileType, DiffSession, DiffHunk } from '../types';

// Generate unique ID
const generateId = () => Math.random().toString(36).substring(2, 11);

// Determine file type from path
const getFileTypeFromPath = (filePath: string): FileType => {
    const lowerPath = filePath.toLowerCase();
    if (['.md', '.markdown', '.mdown', '.mkd', '.mkdn', '.mdx', '.mdwn'].some(ext => lowerPath.endsWith(ext))) return 'markdown';
    if (['.rst', '.rest'].some(ext => lowerPath.endsWith(ext))) return 'rst';
    if (['.txt'].some(ext => lowerPath.endsWith(ext))) return 'text';
    return 'unknown';
};

// Apply hunks based on their status to produce the final content
// This reconstructs the content by selectively applying accepted changes
function applyAcceptedHunks(originalContent: string, modifiedContent: string, hunks: DiffHunk[]): string {
    // If no hunks or all pending, return original
    if (hunks.length === 0 || hunks.every(h => h.status === 'pending')) {
        return originalContent;
    }

    // If all accepted, return modified
    if (hunks.every(h => h.status === 'accepted')) {
        return modifiedContent;
    }

    // If all rejected, return original
    if (hunks.every(h => h.status === 'rejected')) {
        return originalContent;
    }

    // Mixed case: need to selectively apply changes
    // We'll rebuild the content line by line
    const originalLines = originalContent.split('\n');
    const modifiedLines = modifiedContent.split('\n');
    const result: string[] = [];

    // Sort hunks by startLine to ensure correct reconstruction order
    const sortedHunks = [...hunks].sort((a, b) => a.startLine - b.startLine);

    let origIdx = 0;
    let modIdx = 0;

    for (const hunk of sortedHunks) {
        // Copy unchanged lines up to this hunk from the appropriate source
        while (origIdx < hunk.startLine && origIdx < originalLines.length) {
            result.push(originalLines[origIdx]);
            origIdx++;
            modIdx++;
        }

        if (hunk.status === 'accepted') {
            // Use the new lines from modified content
            for (const line of hunk.newLines) {
                result.push(line);
            }
            // Skip original lines that were replaced
            origIdx = hunk.endLine + 1;
            // Advance mod index by new lines count
            modIdx += hunk.newLines.length;
        } else {
            // Use original lines (rejected or pending)
            for (const line of hunk.originalLines) {
                result.push(line);
            }
            origIdx = hunk.endLine + 1;
            modIdx += hunk.type === 'add' ? hunk.newLines.length : hunk.originalLines.length;
        }
    }

    // Copy remaining original lines
    while (origIdx < originalLines.length) {
        result.push(originalLines[origIdx]);
        origIdx++;
    }

    return result.join('\n');
}

// Default config
const defaultConfig: IConfig = {
    recentFiles: [],
    openFiles: [],
    defaultLineEnding: 'CRLF',
    aiChatDocked: false,
    aiChatDockWidth: 420,
};

// Initial state
const initialState: EditorState = {
    openFiles: [],
    activeFileId: null,
    untitledCounter: 1,
    config: defaultConfig,
    notifications: [],
    diffSession: null,
};

// Action types
type EditorAction =
    | { type: 'NEW_FILE' }
    | { type: 'OPEN_FILE'; payload: { id: string; path: string; name: string; content: string; lineEnding: 'CRLF' | 'LF'; viewMode?: 'edit' | 'preview'; fileType?: FileType } }
    | { type: 'CLOSE_FILE'; payload: { id: string } }
    | { type: 'UPDATE_CONTENT'; payload: { id: string; content: string } }
    | { type: 'SET_DIRTY'; payload: { id: string; isDirty: boolean } }
    | { type: 'TOGGLE_VIEW_MODE'; payload: { id: string; scrollPosition?: number } }
    | { type: 'UPDATE_SCROLL_POSITION'; payload: { id: string; scrollPosition: number } }
    | { type: 'SELECT_TAB'; payload: { id: string } }
    | { type: 'SET_CONFIG'; payload: IConfig }
    | { type: 'UPDATE_FILE_PATH'; payload: { id: string; path: string; name: string } }
    | { type: 'SHOW_NOTIFICATION'; payload: Omit<Notification, 'id'> }
    | { type: 'DISMISS_NOTIFICATION'; payload: { id: string } }
    | { type: 'RELOAD_FILE'; payload: { id: string; content: string } }
    | { type: 'UPDATE_FILE_CONTENT'; payload: { id: string; content: string; lineEnding: 'CRLF' | 'LF' } }
    | { type: 'REORDER_TABS'; payload: { fromIndex: number; toIndex: number } }
    | { type: 'UNDO'; payload: { id: string } }
    | { type: 'REDO'; payload: { id: string } }
    | { type: 'PUSH_UNDO'; payload: { id: string; content: string } }
    | { type: 'START_DIFF_SESSION'; payload: { fileId: string; originalContent: string; modifiedContent: string; hunks: DiffHunk[]; summary?: string } }
    | { type: 'ACCEPT_HUNK'; payload: { hunkId: string } }
    | { type: 'REJECT_HUNK'; payload: { hunkId: string } }
    | { type: 'ACCEPT_ALL_HUNKS' }
    | { type: 'SET_CURRENT_HUNK'; payload: { index: number } }
    | { type: 'END_DIFF_SESSION' };

// Reducer
function editorReducer(state: EditorState, action: EditorAction): EditorState {
    switch (action.type) {
        case 'NEW_FILE': {
            const newFile: IFile = {
                id: generateId(),
                path: null,
                name: `Untitled-${state.untitledCounter}`,
                content: '',
                originalContent: '',
                isDirty: true,
                viewMode: 'edit',
                lineEnding: state.config.defaultLineEnding,
                undoStack: [],
                redoStack: [],
                undoStackPointer: 0,
                scrollPosition: 0,
                fileType: 'markdown',
            };
            return {
                ...state,
                openFiles: [...state.openFiles, newFile],
                activeFileId: newFile.id,
                untitledCounter: state.untitledCounter + 1,
            };
        }

        case 'OPEN_FILE': {
            console.log('[EditorContext] OPEN_FILE action received', { 
                id: action.payload.id, 
                path: action.payload.path, 
                name: action.payload.name,
                currentOpenFilesCount: state.openFiles.length 
            });
            
            // Check for duplicate
            const existingFile = state.openFiles.find(f => f.path === action.payload.path);
            if (existingFile) {
                console.log('[EditorContext] File already open, switching to it', { existingFileId: existingFile.id });
                return {
                    ...state,
                    activeFileId: existingFile.id,
                };
            }

            const newFile: IFile = {
                id: action.payload.id,
                path: action.payload.path,
                name: action.payload.name,
                content: action.payload.content,
                originalContent: action.payload.content,
                isDirty: false,
                viewMode: action.payload.viewMode || 'preview',
                lineEnding: action.payload.lineEnding,
                undoStack: [action.payload.content],
                redoStack: [],
                undoStackPointer: 0,
                scrollPosition: 0,
                fileType: action.payload.fileType || 'markdown',
            };
            
            console.log('[EditorContext] Adding new file to state', { 
                fileId: newFile.id, 
                newOpenFilesCount: state.openFiles.length + 1 
            });
            
            return {
                ...state,
                openFiles: [...state.openFiles, newFile],
                activeFileId: newFile.id,
            };
        }

        case 'CLOSE_FILE': {
            const newOpenFiles = state.openFiles.filter(f => f.id !== action.payload.id);
            let newActiveId = state.activeFileId;
            
            if (state.activeFileId === action.payload.id) {
                const closedIndex = state.openFiles.findIndex(f => f.id === action.payload.id);
                if (newOpenFiles.length > 0) {
                    // Select the previous tab, or the first one if closing the first
                    const newIndex = Math.min(closedIndex, newOpenFiles.length - 1);
                    newActiveId = newOpenFiles[newIndex].id;
                } else {
                    newActiveId = null;
                }
            }

            return {
                ...state,
                openFiles: newOpenFiles,
                activeFileId: newActiveId,
            };
        }

        case 'UPDATE_CONTENT': {
            return {
                ...state,
                openFiles: state.openFiles.map(f =>
                    f.id === action.payload.id
                        ? { ...f, content: action.payload.content, isDirty: action.payload.content !== f.originalContent }
                        : f
                ),
            };
        }

        case 'SET_DIRTY': {
            return {
                ...state,
                openFiles: state.openFiles.map(f =>
                    f.id === action.payload.id
                        ? { ...f, isDirty: action.payload.isDirty }
                        : f
                ),
            };
        }

        case 'TOGGLE_VIEW_MODE': {
            return {
                ...state,
                openFiles: state.openFiles.map(f =>
                    f.id === action.payload.id
                        ? { 
                            ...f, 
                            viewMode: f.viewMode === 'edit' ? 'preview' : 'edit',
                            scrollPosition: action.payload.scrollPosition ?? f.scrollPosition
                        }
                        : f
                ),
            };
        }

        case 'UPDATE_SCROLL_POSITION': {
            return {
                ...state,
                openFiles: state.openFiles.map(f =>
                    f.id === action.payload.id
                        ? { ...f, scrollPosition: action.payload.scrollPosition }
                        : f
                ),
            };
        }

        case 'SELECT_TAB': {
            return {
                ...state,
                activeFileId: action.payload.id,
            };
        }

        case 'SET_CONFIG': {
            return {
                ...state,
                config: action.payload,
            };
        }

        case 'UPDATE_FILE_PATH': {
            return {
                ...state,
                openFiles: state.openFiles.map(f =>
                    f.id === action.payload.id
                        ? { ...f, path: action.payload.path, name: action.payload.name, isDirty: false, originalContent: f.content }
                        : f
                ),
            };
        }

        case 'SHOW_NOTIFICATION': {
            const notification: Notification = {
                id: generateId(),
                ...action.payload,
            };
            return {
                ...state,
                notifications: [...state.notifications, notification],
            };
        }

        case 'DISMISS_NOTIFICATION': {
            return {
                ...state,
                notifications: state.notifications.filter(n => n.id !== action.payload.id),
            };
        }

        case 'RELOAD_FILE': {
            return {
                ...state,
                openFiles: state.openFiles.map(f =>
                    f.id === action.payload.id
                        ? { ...f, content: action.payload.content, originalContent: action.payload.content, isDirty: false }
                        : f
                ),
            };
        }

        case 'REORDER_TABS': {
            const { fromIndex, toIndex } = action.payload;
            const newOpenFiles = [...state.openFiles];
            const [movedFile] = newOpenFiles.splice(fromIndex, 1);
            newOpenFiles.splice(toIndex, 0, movedFile);
            return {
                ...state,
                openFiles: newOpenFiles,
            };
        }

        case 'UPDATE_FILE_CONTENT': {
            return {
                ...state,
                openFiles: state.openFiles.map(f =>
                    f.id === action.payload.id
                        ? { 
                            ...f, 
                            content: action.payload.content, 
                            originalContent: action.payload.content,
                            lineEnding: action.payload.lineEnding || f.lineEnding,
                            isDirty: false,
                            undoStack: [action.payload.content],
                            redoStack: [],
                            undoStackPointer: 0,
                        }
                        : f
                ),
            };
        }

        case 'PUSH_UNDO': {
            const MAX_HISTORY = 100;
            return {
                ...state,
                openFiles: state.openFiles.map(f => {
                    if (f.id === action.payload.id) {
                        const newStack = [...f.undoStack.slice(Math.max(0, f.undoStack.length - MAX_HISTORY + 1)), action.payload.content];
                        return {
                            ...f,
                            undoStack: newStack,
                            undoStackPointer: newStack.length - 1,
                            redoStack: [], // Clear redo stack on new edit
                        };
                    }
                    return f;
                }),
            };
        }

        case 'UNDO': {
            return {
                ...state,
                openFiles: state.openFiles.map(f => {
                    if (f.id === action.payload.id && f.undoStackPointer > 0) {
                        const newPointer = f.undoStackPointer - 1;
                        const previousContent = f.undoStack[newPointer];
                        return {
                            ...f,
                            content: previousContent,
                            undoStackPointer: newPointer,
                            redoStack: [...f.redoStack, f.content],
                            isDirty: previousContent !== f.originalContent,
                        };
                    }
                    return f;
                }),
            };
        }

        case 'REDO': {
            return {
                ...state,
                openFiles: state.openFiles.map(f => {
                    if (f.id === action.payload.id && f.redoStack.length > 0) {
                        const newRedoStack = [...f.redoStack];
                        const nextContent = newRedoStack.pop()!;
                        const newStack = [...f.undoStack, nextContent];
                        return {
                            ...f,
                            content: nextContent,
                            undoStack: newStack,
                            undoStackPointer: newStack.length - 1,
                            redoStack: newRedoStack,
                            isDirty: nextContent !== f.originalContent,
                        };
                    }
                    return f;
                }),
            };
        }

        case 'START_DIFF_SESSION': {
            return {
                ...state,
                diffSession: {
                    fileId: action.payload.fileId,
                    originalContent: action.payload.originalContent,
                    modifiedContent: action.payload.modifiedContent,
                    hunks: action.payload.hunks,
                    currentHunkIndex: action.payload.hunks.length > 0 ? 0 : -1,
                    isActive: true,
                    summary: action.payload.summary,
                },
            };
        }

        case 'ACCEPT_HUNK': {
            if (!state.diffSession) return state;
            const updatedHunks = state.diffSession.hunks.map(h =>
                h.id === action.payload.hunkId ? { ...h, status: 'accepted' as const } : h
            );
            // Apply the modified content to the file (showing what's accepted)
            const newContent = applyAcceptedHunks(
                state.diffSession.originalContent,
                state.diffSession.modifiedContent,
                updatedHunks
            );
            // Check if all hunks are resolved
            const allResolved = updatedHunks.every(h => h.status !== 'pending');
            return {
                ...state,
                diffSession: allResolved ? null : { ...state.diffSession, hunks: updatedHunks },
                openFiles: state.openFiles.map(f =>
                    f.id === state.diffSession!.fileId
                        ? { ...f, content: newContent, isDirty: newContent !== f.originalContent }
                        : f
                ),
            };
        }

        case 'REJECT_HUNK': {
            if (!state.diffSession) return state;
            const updatedHunks = state.diffSession.hunks.map(h =>
                h.id === action.payload.hunkId ? { ...h, status: 'rejected' as const } : h
            );
            // Apply the content keeping rejected hunks as original
            const newContent = applyAcceptedHunks(
                state.diffSession.originalContent,
                state.diffSession.modifiedContent,
                updatedHunks
            );
            // Check if all hunks are resolved
            const allResolved = updatedHunks.every(h => h.status !== 'pending');
            return {
                ...state,
                diffSession: allResolved ? null : { ...state.diffSession, hunks: updatedHunks },
                openFiles: state.openFiles.map(f =>
                    f.id === state.diffSession!.fileId
                        ? { ...f, content: newContent, isDirty: newContent !== f.originalContent }
                        : f
                ),
            };
        }

        case 'ACCEPT_ALL_HUNKS': {
            if (!state.diffSession) return state;
            // Use the full modified content when accepting all
            const newContent = state.diffSession.modifiedContent;
            return {
                ...state,
                diffSession: null, // End session
                openFiles: state.openFiles.map(f =>
                    f.id === state.diffSession!.fileId
                        ? { ...f, content: newContent, isDirty: newContent !== f.originalContent }
                        : f
                ),
            };
        }

        case 'SET_CURRENT_HUNK': {
            if (!state.diffSession) return state;
            return {
                ...state,
                diffSession: {
                    ...state.diffSession,
                    currentHunkIndex: action.payload.index,
                },
            };
        }

        case 'END_DIFF_SESSION': {
            if (!state.diffSession) return state;
            // Restore original content when canceling
            return {
                ...state,
                diffSession: null,
                openFiles: state.openFiles.map(f =>
                    f.id === state.diffSession!.fileId
                        ? { ...f, content: state.diffSession!.originalContent }
                        : f
                ),
            };
        }

        default:
            return state;
    }
}

// Context
interface EditorContextType {
    state: EditorState;
    dispatch: React.Dispatch<EditorAction>;
}

const EditorContext = createContext<EditorContextType | null>(null);

// Provider component
interface EditorProviderProps {
    children: ReactNode;
}

export function EditorProvider({ children }: EditorProviderProps) {
    const [state, dispatch] = useReducer(editorReducer, initialState);

    // Load config on mount
    useEffect(() => {
        const loadInitialConfig = async () => {
            try {
                const config = await window.electronAPI.loadConfig();
                dispatch({ type: 'SET_CONFIG', payload: config });

                // Don't automatically restore open files - let App.tsx handle this
                // so it can prioritize command-line files over recent files
            } catch (error) {
                console.error('Failed to load config:', error);
            }
        };

        loadInitialConfig();
    }, []);

    // Set up menu event listeners
    useEffect(() => {
        const cleanups: (() => void)[] = [];

        // Menu: New
        cleanups.push(window.electronAPI.onMenuNew(() => {
            dispatch({ type: 'NEW_FILE' });
        }));

        // Menu: Open
        cleanups.push(window.electronAPI.onMenuOpen(async () => {
            const results = await window.electronAPI.openFile();
            if (results && results.length > 0) {
                for (const result of results) {
                    dispatch({
                        type: 'OPEN_FILE',
                        payload: {
                            id: generateId(),
                            path: result.filePath,
                            name: result.filePath.split(/[\\/]/).pop() || 'Unknown',
                            content: result.content,
                            lineEnding: result.lineEnding,
                            fileType: getFileTypeFromPath(result.filePath),
                        },
                    });
                }
            }
        }));

        return () => {
            cleanups.forEach(cleanup => cleanup());
        };
    }, []);

    // Sync recent files with open files before closing
    useEffect(() => {
        const handleBeforeUnload = async () => {
            const openFileRefs = state.openFiles
                .filter(f => f.path !== null && !f.path.endsWith('config.json'))
                .map(f => ({ fileName: f.path!, mode: f.viewMode }));

            if (openFileRefs.length > 0) {
                await window.electronAPI.syncRecentFiles(openFileRefs);
            }
        };

        window.addEventListener('beforeunload', handleBeforeUnload);

        return () => {
            window.removeEventListener('beforeunload', handleBeforeUnload);
        };
    }, [state.openFiles]);

    // Watch/unwatch files when they're opened/closed
    // Use a ref to track which files we've already requested to watch
    const watchedFilesRef = React.useRef<Set<string>>(new Set());
    
    useEffect(() => {
        const currentPaths = new Set(
            state.openFiles
                .map(f => f.path)
                .filter((p): p is string => p !== null && !p.endsWith('markdownplus-debug.log'))
        );
        
        // Watch newly opened files
        currentPaths.forEach(path => {
            if (!watchedFilesRef.current.has(path)) {
                window.electronAPI.watchFile(path);
                watchedFilesRef.current.add(path);
            }
        });
        
        // Unwatch closed files
        watchedFilesRef.current.forEach(path => {
            if (!currentPaths.has(path)) {
                window.electronAPI.unwatchFile(path);
                watchedFilesRef.current.delete(path);
            }
        });
    }, [state.openFiles]);

    return (
        <EditorContext.Provider value={{ state, dispatch }}>
            {children}
        </EditorContext.Provider>
    );
}

// Hook to use editor state
export function useEditorState() {
    const context = useContext(EditorContext);
    if (!context) {
        throw new Error('useEditorState must be used within EditorProvider');
    }
    return context.state;
}

// Hook to use editor dispatch
export function useEditorDispatch() {
    const context = useContext(EditorContext);
    if (!context) {
        throw new Error('useEditorDispatch must be used within EditorProvider');
    }
    return context.dispatch;
}

// Hook to get active file
export function useActiveFile() {
    const state = useEditorState();
    return state.openFiles.find(f => f.id === state.activeFileId) || null;
}

// Hook to get diff session
export function useDiffSession() {
    const state = useEditorState();
    return state.diffSession;
}
