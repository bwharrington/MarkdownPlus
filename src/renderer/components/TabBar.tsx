import React from 'react';
import { Tabs, Tab, Box, IconButton, Tooltip, styled } from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import SaveIcon from '@mui/icons-material/Save';
import CodeIcon from '@mui/icons-material/Code';
import DescriptionIcon from '@mui/icons-material/Description';
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

    const handleToggleViewMode = (e: React.MouseEvent) => {
        e.stopPropagation();
        dispatch({ type: 'TOGGLE_VIEW_MODE', payload: { id: file.id } });
    };

    const handleClose = (e: React.MouseEvent) => {
        e.stopPropagation();
        closeFile(file.id);
    };

    return (
        <TabContent>
            {file.isDirty && (
                <Tooltip title="Unsaved changes">
                    <SaveIcon 
                        sx={{ 
                            fontSize: 16, 
                            opacity: 0.7,
                            color: 'warning.main',
                        }} 
                    />
                </Tooltip>
            )}
            <Tooltip title={file.path || 'Unsaved file'}>
                <FileName>{file.name}</FileName>
            </Tooltip>
            <Tooltip title={file.viewMode === 'edit' ? 'Switch to preview' : 'Switch to edit'}>
                <IconButton
                    component="span"
                    size="small"
                    onClick={handleToggleViewMode}
                    sx={{ padding: 0.5 }}
                >
                    {file.viewMode === 'edit' ? (
                        <CodeIcon sx={{ fontSize: 16 }} />
                    ) : (
                        <DescriptionIcon sx={{ fontSize: 16 }} />
                    )}
                </IconButton>
            </Tooltip>
            <Tooltip title="Close">
                <IconButton
                    component="span"
                    size="small"
                    onClick={handleClose}
                    sx={{ padding: 0.5 }}
                >
                    <CloseIcon sx={{ fontSize: 16 }} />
                </IconButton>
            </Tooltip>
        </TabContent>
    );
}

export function TabBar() {
    const state = useEditorState();
    const dispatch = useEditorDispatch();
    const [draggedIndex, setDraggedIndex] = React.useState<number | null>(null);

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
        </TabContainer>
    );
}
