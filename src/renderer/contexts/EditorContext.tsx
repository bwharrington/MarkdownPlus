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
    | { type: 'TOGGLE_VIEW_MODE'; payload: { id: string } }
    | { type: 'SELECT_TAB'; payload: { id: string } }
    | { type: 'SET_CONFIG'; payload: IConfig }
    | { type: 'UPDATE_FILE_PATH'; payload: { id: string; path: string; name: string } }
    | { type: 'SHOW_NOTIFICATION'; payload: Omit<Notification, 'id'> }
    | { type: 'DISMISS_NOTIFICATION'; payload: { id: string } }
    | { type: 'RELOAD_FILE'; payload: { id: string; content: string } };

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
                viewMode: 'markdown',
                lineEnding: state.config.defaultLineEnding,
            };
            return {
                ...state,
                openFiles: [...state.openFiles, newFile],
                activeFileId: newFile.id,
                untitledCounter: state.untitledCounter + 1,
            };
        }

        case 'OPEN_FILE': {
            // Check for duplicate
            const existingFile = state.openFiles.find(f => f.path === action.payload.path);
            if (existingFile) {
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
                viewMode: 'markdown',
                lineEnding: action.payload.lineEnding,
            };
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
                        ? { ...f, viewMode: f.viewMode === 'markdown' ? 'plaintext' : 'markdown' }
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

                // Restore open files from last session
                for (const filePath of config.openFiles) {
                    try {
                        const result = await window.electronAPI.readFile(filePath);
                        if (result) {
                            dispatch({
                                type: 'OPEN_FILE',
                                payload: {
                                    id: generateId(),
                                    path: result.filePath,
                                    name: filePath.split(/[\\/]/).pop() || 'Unknown',
                                    content: result.content,
                                    lineEnding: result.lineEnding,
                                },
                            });
                        }
                    } catch {
                        dispatch({
                            type: 'SHOW_NOTIFICATION',
                            payload: {
                                message: `Could not open "${filePath.split(/[\\/]/).pop()}"`,
                                severity: 'warning',
                            },
                        });
                    }
                }
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
            }
        }));

        return () => {
            cleanups.forEach(cleanup => cleanup());
        };
    }, []);

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
