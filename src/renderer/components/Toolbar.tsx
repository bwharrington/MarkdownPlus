import React from 'react';
import { AppBar, Toolbar as MuiToolbar, IconButton, Tooltip, Divider, Box, Typography, styled } from '@mui/material';
import NoteAddIcon from '@mui/icons-material/NoteAdd';
import FolderOpenIcon from '@mui/icons-material/FolderOpen';
import SaveIcon from '@mui/icons-material/Save';
import SaveAltIcon from '@mui/icons-material/SaveAlt';
import CloseIcon from '@mui/icons-material/Close';
import ClearAllIcon from '@mui/icons-material/ClearAll';
import SettingsIcon from '@mui/icons-material/Settings';
import Brightness4Icon from '@mui/icons-material/Brightness4';
import Brightness7Icon from '@mui/icons-material/Brightness7';
import MinimizeIcon from '@mui/icons-material/Minimize';
import CropSquareIcon from '@mui/icons-material/CropSquare';
import { useFileOperations } from '../hooks';
import { useEditorState, useActiveFile, useTheme } from '../contexts';
import AppIcon from '../../../assets/MarkdownPlus.svg';

const StyledAppBar = styled(AppBar)(({ theme }) => ({
    backgroundColor: theme.palette.background.paper,
    color: theme.palette.text.primary,
    boxShadow: 'none',
    borderBottom: `1px solid ${theme.palette.divider}`,
}));

const StyledToolbar = styled(MuiToolbar)({
    WebkitAppRegion: 'drag',
});

const AppLogo = styled(Box)({
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    marginRight: 16,
    WebkitAppRegion: 'no-drag',
});

const ToolbarDivider = styled(Divider)({
    margin: '0 8px',
    height: 24,
    WebkitAppRegion: 'no-drag',
});

const DraggableSpacer = styled(Box)({
    flexGrow: 1,
    WebkitAppRegion: 'drag',
});

export function Toolbar() {
    const state = useEditorState();
    const activeFile = useActiveFile();
    const { mode, toggleTheme } = useTheme();
    const {
        createNewFile,
        openFile,
        saveFile,
        saveAllFiles,
        closeFile,
        closeAllFiles,
        openConfigFile,
        hasDirtyFiles,
    } = useFileOperations();

    const hasOpenFiles = state.openFiles.length > 0;
    const canSave = activeFile?.isDirty || activeFile?.path === null;

    const handleMinimize = () => {
        window.electronAPI.minimizeWindow();
    };

    const handleMaximize = () => {
        window.electronAPI.maximizeWindow();
    };

    const handleClose = () => {
        window.electronAPI.closeWindow();
    };

    return (
        <StyledAppBar position="static">
            <StyledToolbar variant="dense">
                <AppLogo>
                    <img src={AppIcon} alt="MarkdownPlus" width={24} height={24} />
                    <Typography variant="subtitle1" fontWeight={600}>
                        MarkdownPlus
                    </Typography>
                </AppLogo>

                <ToolbarDivider orientation="vertical" flexItem />

                <Tooltip title="New (Ctrl+N)">
                    <IconButton onClick={createNewFile} color="inherit" sx={{ WebkitAppRegion: 'no-drag' }}>
                        <NoteAddIcon />
                    </IconButton>
                </Tooltip>
                <Tooltip title="Open (Ctrl+O)">
                    <IconButton onClick={openFile} color="inherit" sx={{ WebkitAppRegion: 'no-drag' }}>
                        <FolderOpenIcon />
                    </IconButton>
                </Tooltip>

                <ToolbarDivider orientation="vertical" flexItem />

                <Tooltip title="Save (Ctrl+S)">
                    <span>
                        <IconButton 
                            onClick={() => saveFile()} 
                            color="inherit"
                            disabled={!canSave}
                            sx={{ WebkitAppRegion: 'no-drag' }}
                        >
                            <SaveIcon />
                        </IconButton>
                    </span>
                </Tooltip>
                <Tooltip title="Save All">
                    <span>
                        <IconButton 
                            onClick={saveAllFiles} 
                            color="inherit"
                            disabled={!hasDirtyFiles}
                            sx={{ WebkitAppRegion: 'no-drag' }}
                        >
                            <SaveAltIcon />
                        </IconButton>
                    </span>
                </Tooltip>

                <ToolbarDivider orientation="vertical" flexItem />

                <Tooltip title="Close (Ctrl+W)">
                    <span>
                        <IconButton 
                            onClick={() => closeFile()} 
                            color="inherit"
                            disabled={!hasOpenFiles}
                            sx={{ WebkitAppRegion: 'no-drag' }}
                        >
                            <CloseIcon />
                        </IconButton>
                    </span>
                </Tooltip>
                <Tooltip title="Close All">
                    <span>
                        <IconButton 
                            onClick={closeAllFiles} 
                            color="inherit"
                            disabled={!hasOpenFiles}
                            sx={{ WebkitAppRegion: 'no-drag' }}
                        >
                            <ClearAllIcon />
                        </IconButton>
                    </span>
                </Tooltip>

                <DraggableSpacer />

                <Tooltip title={mode === 'dark' ? 'Switch to Light Mode' : 'Switch to Dark Mode'}>
                    <IconButton onClick={toggleTheme} color="inherit" sx={{ WebkitAppRegion: 'no-drag' }}>
                        {mode === 'dark' ? <Brightness7Icon /> : <Brightness4Icon />}
                    </IconButton>
                </Tooltip>

                <Tooltip title="Settings">
                    <IconButton onClick={openConfigFile} color="inherit" sx={{ WebkitAppRegion: 'no-drag' }}>
                        <SettingsIcon />
                    </IconButton>
                </Tooltip>

                <ToolbarDivider orientation="vertical" flexItem />

                <Tooltip title="Minimize">
                    <IconButton onClick={handleMinimize} color="inherit" size="small" sx={{ WebkitAppRegion: 'no-drag' }}>
                        <MinimizeIcon />
                    </IconButton>
                </Tooltip>

                <Tooltip title="Maximize">
                    <IconButton onClick={handleMaximize} color="inherit" size="small" sx={{ WebkitAppRegion: 'no-drag' }}>
                        <CropSquareIcon />
                    </IconButton>
                </Tooltip>

                <Tooltip title="Close">
                    <IconButton onClick={handleClose} color="inherit" size="small" sx={{ WebkitAppRegion: 'no-drag' }}>
                        <CloseIcon />
                    </IconButton>
                </Tooltip>
            </StyledToolbar>
        </StyledAppBar>
    );
}
