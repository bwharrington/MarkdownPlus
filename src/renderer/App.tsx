import React, { useEffect } from 'react';
import { CssBaseline, Box, styled } from '@mui/material';
import { EditorProvider, useEditorState, ThemeProvider } from './contexts';
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
    const { saveFile, saveFileAs, saveAllFiles, openFile, closeFile, closeAllFiles, showInFolder, createNewFile } = useFileOperations();
    
    // Set up window title management
    useWindowTitle();

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
