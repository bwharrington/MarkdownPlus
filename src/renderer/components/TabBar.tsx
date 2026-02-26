import React, { useCallback } from 'react';
import { Tabs, Tab, Box, IconButton, Tooltip, styled, Menu, MenuItem, Dialog, DialogTitle, DialogContent, DialogActions, Button, TextField } from '@mui/material';
import {
    CloseIcon,
    SaveIcon,
    CodeIcon,
    DescriptionIcon,
    EditIcon,
    FolderOpenIcon,
    FileDiffIcon,
    PlusIcon,
    MinusIcon,
    VisibilityIcon,
    VisibilityOffIcon,
    CopyIcon,
    ClipboardCopyIcon,
} from './AppIcons';
import { useEditorState, useEditorDispatch } from '../contexts';
import { useFileOperations } from '../hooks';
import type { IFile } from '../types';
import type { AttachedFile } from './FileAttachmentsList';

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

const FileTab = React.memo(function FileTab({ file, isActive }: FileTabProps) {
    const dispatch = useEditorDispatch();
    const { closeFile } = useFileOperations();
    const isDiffTab = file.viewMode === 'diff';

    const handleToggleViewMode = useCallback((e: React.MouseEvent) => {
        e.stopPropagation();
        dispatch({ type: 'TOGGLE_VIEW_MODE', payload: { id: file.id } });
    }, [file.id, dispatch]);

    const handleClose = useCallback((e: React.MouseEvent) => {
        e.stopPropagation();
        if (isDiffTab) {
            dispatch({ type: 'CLOSE_DIFF_TAB', payload: { diffTabId: file.id } });
        } else {
            closeFile(file.id);
        }
    }, [file.id, isDiffTab, dispatch, closeFile]);

    const tooltipTitle = isDiffTab ? 'AI Changes' : (file.path || 'Unsaved file');

    return (
        <Tooltip title={tooltipTitle} enterDelay={600} placement="bottom">
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
            <FileName>{file.name}</FileName>
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
        </Tooltip>
    );
});

interface TabBarProps {
    attachedFiles: AttachedFile[];
    onToggleFileAttachment: (file: IFile) => void;
    onToggleContextDoc: (filePath: string) => void;
}

export function TabBar({ attachedFiles, onToggleFileAttachment, onToggleContextDoc }: TabBarProps) {
    const state = useEditorState();
    const dispatch = useEditorDispatch();
    const [draggedIndex, setDraggedIndex] = React.useState<number | null>(null);
    const [contextMenu, setContextMenu] = React.useState<{ mouseX: number; mouseY: number; fileId: string } | null>(null);
    const [renameDialog, setRenameDialog] = React.useState<{ open: boolean; fileId: string; currentName: string }>({ open: false, fileId: '', currentName: '' });
    const [newFileName, setNewFileName] = React.useState('');
    const { renameFile, showInFolder } = useFileOperations();

    const handleTabChange = useCallback((_event: React.SyntheticEvent, newValue: string) => {
        dispatch({ type: 'SELECT_TAB', payload: { id: newValue } });
    }, [dispatch]);

    const handleDragStart = useCallback((e: React.DragEvent, index: number) => {
        setDraggedIndex(index);
        e.dataTransfer.effectAllowed = 'move';
    }, []);

    const handleDragOver = useCallback((e: React.DragEvent, index: number) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';

        if (draggedIndex !== null && draggedIndex !== index) {
            dispatch({
                type: 'REORDER_TABS',
                payload: { fromIndex: draggedIndex, toIndex: index },
            });
            setDraggedIndex(index);
        }
    }, [draggedIndex, dispatch]);

    const handleDragEnd = useCallback(() => {
        setDraggedIndex(null);
    }, []);

    const handleContextMenu = useCallback((e: React.MouseEvent, fileId: string) => {
        e.preventDefault();
        setContextMenu(prev => prev === null ? { mouseX: e.clientX - 2, mouseY: e.clientY - 4, fileId } : null);
    }, []);

    const handleContextMenuClose = useCallback(() => {
        setContextMenu(null);
    }, []);

    const handleRenameClick = useCallback(() => {
        setContextMenu(prev => {
            if (prev) {
                const file = state.openFiles.find(f => f.id === prev.fileId);
                if (file) {
                    setNewFileName(file.name);
                    setRenameDialog({ open: true, fileId: file.id, currentName: file.name });
                }
            }
            return null;
        });
    }, [state.openFiles]);

    const handleOpenLocationClick = useCallback(async () => {
        if (contextMenu) {
            const file = state.openFiles.find(f => f.id === contextMenu.fileId);
            if (file && file.path) {
                await window.electronAPI.showInFolder(file.path);
            }
        }
        setContextMenu(null);
    }, [contextMenu, state.openFiles]);

    const handleCopyFileContent = useCallback(async () => {
        if (contextMenu) {
            const file = state.openFiles.find(f => f.id === contextMenu.fileId);
            if (file) {
                await navigator.clipboard.writeText(file.content);
            }
        }
        setContextMenu(null);
    }, [contextMenu, state.openFiles]);

    const handleCopyFilePath = useCallback(async () => {
        if (contextMenu) {
            const file = state.openFiles.find(f => f.id === contextMenu.fileId);
            if (file?.path) {
                await navigator.clipboard.writeText(file.path);
            }
        }
        setContextMenu(null);
    }, [contextMenu, state.openFiles]);

    const handleAttachToggleClick = useCallback(() => {
        if (contextMenu) {
            const file = state.openFiles.find(f => f.id === contextMenu.fileId);
            if (file) {
                onToggleFileAttachment(file);
            }
        }
        setContextMenu(null);
    }, [contextMenu, state.openFiles, onToggleFileAttachment]);

    const handleContextDocToggleClick = useCallback(() => {
        if (contextMenu) {
            const file = state.openFiles.find(f => f.id === contextMenu.fileId);
            if (file?.path) {
                onToggleContextDoc(file.path);
            }
        }
        setContextMenu(null);
    }, [contextMenu, state.openFiles, onToggleContextDoc]);

    const handleRenameDialogClose = useCallback(() => {
        setRenameDialog({ open: false, fileId: '', currentName: '' });
        setNewFileName('');
    }, []);

    const handleRenameConfirm = useCallback(async () => {
        if (renameDialog.fileId && newFileName && newFileName !== renameDialog.currentName) {
            await renameFile(renameDialog.fileId, newFileName);
        }
        setRenameDialog({ open: false, fileId: '', currentName: '' });
        setNewFileName('');
    }, [renameDialog.fileId, renameDialog.currentName, newFileName, renameFile]);

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
                <MenuItem
                    onClick={handleCopyFileContent}
                    disabled={state.openFiles.find(f => f.id === contextMenu?.fileId)?.viewMode === 'diff'}
                >
                    <CopyIcon size={18} sx={{ mr: 1 }} />
                    Copy File Contents
                </MenuItem>
                <MenuItem
                    onClick={handleCopyFilePath}
                    disabled={!state.openFiles.find(f => f.id === contextMenu?.fileId)?.path}
                >
                    <ClipboardCopyIcon size={18} sx={{ mr: 1 }} />
                    Copy File Path
                </MenuItem>
                {(() => {
                    const contextFile = contextMenu
                        ? state.openFiles.find(f => f.id === contextMenu.fileId)
                        : null;
                    const attachedEntry = contextFile?.path
                        ? attachedFiles.find(af => af.path === contextFile.path)
                        : undefined;
                    const isContextDoc = attachedEntry?.isContextDoc === true;
                    const isContextDocEnabled = attachedEntry?.enabled !== false;
                    const isManuallyAttached = attachedEntry !== undefined && !isContextDoc;

                    if (isContextDoc) {
                        return (
                            <MenuItem
                                onClick={handleContextDocToggleClick}
                                disabled={!contextFile?.path || contextFile?.viewMode === 'diff'}
                            >
                                {isContextDocEnabled ? (
                                    <VisibilityIcon fontSize="small" sx={{ mr: 1, color: 'primary.main' }} />
                                ) : (
                                    <VisibilityOffIcon fontSize="small" sx={{ mr: 1, color: 'text.disabled' }} />
                                )}
                                {isContextDocEnabled ? `Hide "${contextFile?.name}" from AI` : `Show "${contextFile?.name}" to AI`}
                            </MenuItem>
                        );
                    }

                    return (
                        <MenuItem
                            onClick={handleAttachToggleClick}
                            disabled={!contextFile?.path || contextFile?.viewMode === 'diff'}
                        >
                            {isManuallyAttached ? (
                                <MinusIcon size={18} sx={{ mr: 1, color: 'error.main' }} />
                            ) : (
                                <PlusIcon size={18} sx={{ mr: 1, color: 'success.main' }} />
                            )}
                            {isManuallyAttached ? `Remove '${contextFile?.name}' from Nexus` : `Attach '${contextFile?.name}' to Nexus`}
                        </MenuItem>
                    );
                })()}
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
