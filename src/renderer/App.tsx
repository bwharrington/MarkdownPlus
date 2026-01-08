import React, { useEffect } from 'react';
import { CssBaseline, Box, styled } from '@mui/material';
import { EditorProvider, useEditorState, useEditorDispatch, ThemeProvider } from './contexts';
import { Toolbar, TabBar, EditorPane, EmptyState, NotificationSnackbar } from './components';
import { useWindowTitle, useFileOperations } from './hooks';

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
