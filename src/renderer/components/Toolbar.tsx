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
import { useFileOperations } from '../hooks';
import { useEditorState, useActiveFile, useTheme } from '../contexts';
import AppIcon from '../../../assets/MarkdownPlus.svg';

const StyledAppBar = styled(AppBar)(({ theme }) => ({
    backgroundColor: theme.palette.background.paper,
    color: theme.palette.text.primary,
    boxShadow: 'none',
    borderBottom: `1px solid ${theme.palette.divider}`,
}));

const AppLogo = styled(Box)({
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    marginRight: 16,
});

const ToolbarDivider = styled(Divider)({
    margin: '0 8px',
    height: 24,
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

    return (
        <StyledAppBar position="static">
            <MuiToolbar variant="dense">
                <AppLogo>
                    <img src={AppIcon} alt="MarkdownPlus" width={24} height={24} />
                    <Typography variant="subtitle1" fontWeight={600}>
                        MarkdownPlus
                    </Typography>
                </AppLogo>

                <ToolbarDivider orientation="vertical" flexItem />

                <Tooltip title="New (Ctrl+N)">
                    <IconButton onClick={createNewFile} color="inherit">
                        <NoteAddIcon />
                    </IconButton>
                </Tooltip>
                <Tooltip title="Open (Ctrl+O)">
                    <IconButton onClick={openFile} color="inherit">
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
                        >
                            <ClearAllIcon />
                        </IconButton>
                    </span>
                </Tooltip>

                <Box sx={{ flexGrow: 1 }} />

                <Tooltip title={mode === 'dark' ? 'Switch to Light Mode' : 'Switch to Dark Mode'}>
                    <IconButton onClick={toggleTheme} color="inherit">
                        {mode === 'dark' ? <Brightness7Icon /> : <Brightness4Icon />}
                    </IconButton>
                </Tooltip>

                <Tooltip title="Settings">
                    <IconButton onClick={openConfigFile} color="inherit">
                        <SettingsIcon />
                    </IconButton>
                </Tooltip>
            </MuiToolbar>
        </StyledAppBar>
    );
}
