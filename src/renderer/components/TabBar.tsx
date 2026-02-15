import React from 'react';
import { Tabs, Tab, Box, IconButton, Tooltip, styled, Menu, MenuItem, Dialog, DialogTitle, DialogContent, DialogActions, Button, TextField } from '@mui/material';
import {
    CloseIcon,
    SaveIcon,
    CodeIcon,
    DescriptionIcon,
    EditIcon,
    FolderOpenIcon,
    FileDiffIcon,
} from './AppIcons';
import { useEditorState, useEditorDispatch } from '../contexts';
import { useFileOperations } from '../hooks';
import type { IFile } from '../types';

const TabContainer = styled(Box)(({ theme }) => ({
    backgroundColor: theme.palette.background.paper,
    borderBottom: `1px solid ${theme.palette.divider}`,
}));

const StyledTab = styled(Tab)(({ theme }) => ({
    textTransform: 'none',
    minHeight: 40,
    padding: '6px 12px',
    '&.Mui-selected': {
        backgroundColor: theme.palette.action.selected,
    },
}));

const TabContent = styled(Box)({
    display: 'flex',
    alignItems: 'center',
    gap: 4,
    maxWidth: 200,
});

const FileName = styled('span')({
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
    maxWidth: 120,
});

interface FileTabProps {
    file: IFile;
    isActive: boolean;
}

function FileTab({ file, isActive }: FileTabProps) {
    const dispatch = useEditorDispatch();
    const { closeFile } = useFileOperations();
    const isDiffTab = file.viewMode === 'diff';

    const handleToggleViewMode = (e: React.MouseEvent) => {
        e.stopPropagation();
        dispatch({ type: 'TOGGLE_VIEW_MODE', payload: { id: file.id } });
    };

    const handleClose = (e: React.MouseEvent) => {
        e.stopPropagation();
        if (isDiffTab) {
            dispatch({ type: 'CLOSE_DIFF_TAB', payload: { diffTabId: file.id } });
        } else {
            closeFile(file.id);
        }
    };

    return (
        <TabContent>
            {isDiffTab ? (
                <Tooltip title="AI Diff">
                    <FileDiffIcon
                        size={16}
                        sx={{
                            opacity: 0.7,
                            color: 'info.main',
                        }}
                    />
                </Tooltip>
            ) : file.isDirty ? (
                <Tooltip title="Unsaved changes">
                    <SaveIcon
                        size={16}
                        sx={{
                            opacity: 0.7,
                            color: 'warning.main',
                        }}
                    />
                </Tooltip>
            ) : null}
            <Tooltip title={isDiffTab ? 'AI Changes' : (file.path || 'Unsaved file')}>
                <FileName>{file.name}</FileName>
            </Tooltip>
            {!isDiffTab && (
                <Tooltip title={file.viewMode === 'edit' ? 'Switch to preview (Ctrl+E)' : 'Switch to edit (Ctrl+E)'}>
                    <IconButton
                        component="span"
                        size="small"
                        onClick={handleToggleViewMode}
                        sx={{ padding: 0.5 }}
                    >
                        {file.viewMode === 'edit' ? (
                            <CodeIcon size={16} />
                        ) : (
                            <DescriptionIcon size={16} />
                        )}
                    </IconButton>
                </Tooltip>
            )}
            <Tooltip title="Close">
                <IconButton
                    component="span"
                    size="small"
                    onClick={handleClose}
                    sx={{ padding: 0.5 }}
                >
                    <CloseIcon size={16} />
                </IconButton>
            </Tooltip>
        </TabContent>
    );
}

export function TabBar() {
    const state = useEditorState();
    const dispatch = useEditorDispatch();
    const [draggedIndex, setDraggedIndex] = React.useState<number | null>(null);
    const [contextMenu, setContextMenu] = React.useState<{ mouseX: number; mouseY: number; fileId: string } | null>(null);
    const [renameDialog, setRenameDialog] = React.useState<{ open: boolean; fileId: string; currentName: string }>({ open: false, fileId: '', currentName: '' });
    const [newFileName, setNewFileName] = React.useState('');
    const { renameFile, showInFolder } = useFileOperations();

    const handleTabChange = (_event: React.SyntheticEvent, newValue: string) => {
        dispatch({ type: 'SELECT_TAB', payload: { id: newValue } });
    };

    const handleDragStart = (e: React.DragEvent, index: number) => {
        setDraggedIndex(index);
        e.dataTransfer.effectAllowed = 'move';
    };

    const handleDragOver = (e: React.DragEvent, index: number) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
        
        if (draggedIndex !== null && draggedIndex !== index) {
            dispatch({ 
                type: 'REORDER_TABS', 
                payload: { fromIndex: draggedIndex, toIndex: index } 
            });
            setDraggedIndex(index);
        }
    };

    const handleDragEnd = () => {
        setDraggedIndex(null);
    };

    const handleContextMenu = (e: React.MouseEvent, fileId: string) => {
        e.preventDefault();
        setContextMenu(contextMenu === null ? { mouseX: e.clientX - 2, mouseY: e.clientY - 4, fileId } : null);
    };

    const handleContextMenuClose = () => {
        setContextMenu(null);
    };

    const handleRenameClick = () => {
        if (contextMenu) {
            const file = state.openFiles.find(f => f.id === contextMenu.fileId);
            if (file) {
                setNewFileName(file.name);
                setRenameDialog({ open: true, fileId: file.id, currentName: file.name });
            }
        }
        handleContextMenuClose();
    };

    const handleOpenLocationClick = async () => {
        if (contextMenu) {
            const file = state.openFiles.find(f => f.id === contextMenu.fileId);
            if (file && file.path) {
                await window.electronAPI.showInFolder(file.path);
            }
        }
        handleContextMenuClose();
    };

    const handleRenameDialogClose = () => {
        setRenameDialog({ open: false, fileId: '', currentName: '' });
        setNewFileName('');
    };

    const handleRenameConfirm = async () => {
        if (renameDialog.fileId && newFileName && newFileName !== renameDialog.currentName) {
            await renameFile(renameDialog.fileId, newFileName);
        }
        handleRenameDialogClose();
    };

    if (state.openFiles.length === 0) {
        return null;
    }

    return (
        <TabContainer>
            <Tabs
                value={state.activeFileId || false}
                onChange={handleTabChange}
                variant="scrollable"
                scrollButtons="auto"
                sx={{ minHeight: 40 }}
            >
                {state.openFiles.map((file, index) => (
                    <StyledTab
                        key={file.id}
                        value={file.id}
                        label={<FileTab file={file} isActive={file.id === state.activeFileId} />}
                        draggable
                        onDragStart={(e) => handleDragStart(e, index)}
                        onDragOver={(e) => handleDragOver(e, index)}
                        onDragEnd={handleDragEnd}
                        onContextMenu={(e) => handleContextMenu(e, file.id)}
                        sx={{
                            cursor: 'grab',
                            '&:active': {
                                cursor: 'grabbing',
                            },
                            opacity: draggedIndex === index ? 0.5 : 1,
                        }}
                    />
                ))}
            </Tabs>
            <Menu
                open={contextMenu !== null}
                onClose={handleContextMenuClose}
                anchorReference="anchorPosition"
                anchorPosition={
                    contextMenu !== null
                        ? { top: contextMenu.mouseY, left: contextMenu.mouseX }
                        : undefined
                }
            >
                <MenuItem onClick={handleRenameClick}>
                    <EditIcon size={18} sx={{ mr: 1 }} />
                    Rename
                </MenuItem>
                <MenuItem 
                    onClick={handleOpenLocationClick}
                    disabled={!state.openFiles.find(f => f.id === contextMenu?.fileId)?.path}
                >
                    <FolderOpenIcon size={18} sx={{ mr: 1 }} />
                    Open File Location
                </MenuItem>
            </Menu>
            <Dialog open={renameDialog.open} onClose={handleRenameDialogClose}>
                <DialogTitle>Rename File</DialogTitle>
                <DialogContent>
                    <TextField
                        autoFocus
                        margin="dense"
                        label="File Name"
                        type="text"
                        fullWidth
                        variant="outlined"
                        value={newFileName}
                        onChange={(e) => setNewFileName(e.target.value)}
                        onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                                handleRenameConfirm();
                            }
                        }}
                    />
                </DialogContent>
                <DialogActions>
                    <Button onClick={handleRenameDialogClose}>Cancel</Button>
                    <Button onClick={handleRenameConfirm} variant="contained" disabled={!newFileName || newFileName === renameDialog.currentName}>
                        Rename
                    </Button>
                </DialogActions>
            </Dialog>
        </TabContainer>
    );
}
