import React, { createContext, useContext, useReducer, useEffect, ReactNode } from 'react';
import type { IFile, EditorState, Notification, IConfig } from '../types';

// Generate unique ID
const generateId = () => Math.random().toString(36).substring(2, 11);

// Default config
const defaultConfig: IConfig = {
    recentFiles: [],
    openFiles: [],
    defaultLineEnding: 'CRLF',
};

// Initial state
const initialState: EditorState = {
    openFiles: [],
    activeFileId: null,
    untitledCounter: 1,
    config: defaultConfig,
    notifications: [],
};

// Action types
type EditorAction =
    | { type: 'NEW_FILE' }
    | { type: 'OPEN_FILE'; payload: { id: string; path: string; name: string; content: string; lineEnding: 'CRLF' | 'LF' } }
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
    | { type: 'PUSH_UNDO'; payload: { id: string; content: string } };

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
                viewMode: 'edit',
                lineEnding: action.payload.lineEnding,
                undoStack: [action.payload.content],
                redoStack: [],
                undoStackPointer: 0,
                scrollPosition: 0,
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
            const openFilePaths = state.openFiles
                .map(f => f.path)
                .filter((p): p is string => p !== null && !p.endsWith('config.json'));
            
            if (openFilePaths.length > 0) {
                await window.electronAPI.syncRecentFiles(openFilePaths);
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
