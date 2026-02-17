import React, { useRef, useEffect, useState, useCallback } from 'react';
import { Box, styled, TextField, Button, IconButton, Typography, Tabs, Tab } from '@mui/material';
import { CloseIcon, DragIndicatorIcon } from './AppIcons';
import { useDraggableDialog } from '../hooks/useDraggableDialog';

const DialogContainer = styled(Box)(({ theme }) => ({
    position: 'absolute',
    zIndex: 1000,
    backgroundColor: theme.palette.background.paper,
    border: `1px solid ${theme.palette.divider}`,
    borderRadius: 4,
    boxShadow: theme.shadows[4],
    minWidth: 320,
    overflow: 'hidden',
}));

const DragHandle = styled(Box)(({ theme }) => ({
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '4px',
    cursor: 'move',
    backgroundColor: theme.palette.action.hover,
    borderBottom: `1px solid ${theme.palette.divider}`,
    '&:hover': {
        backgroundColor: theme.palette.action.selected,
    },
}));

const StyledTabs = styled(Tabs)(({ theme }) => ({
    borderBottom: `1px solid ${theme.palette.divider}`,
    minHeight: 36,
    '& .MuiTabs-indicator': {
        height: 2,
    },
}));

const StyledTab = styled(Tab)({
    textTransform: 'none',
    minHeight: 36,
    minWidth: 80,
    fontSize: 13,
    padding: '6px 16px',
});

const DialogContent = styled(Box)({
    padding: 16,
});

interface FindReplaceDialogProps {
    open: boolean;
    mode: 'edit' | 'preview';
    activeTab: 'find' | 'replace';
    searchQuery: string;
    replaceQuery: string;
    matchCount: number | null;
    currentMatchIndex: number;
    totalMatches: number;
    onTabChange: (tab: 'find' | 'replace') => void;
    onSearchQueryChange: (query: string) => void;
    onReplaceQueryChange: (query: string) => void;
    onFindNext: () => void;
    onCount: () => void;
    onReplace: () => void;
    onReplaceAll: () => void;
    onClose: () => void;
}

export function FindReplaceDialog({
    open,
    mode,
    activeTab,
    searchQuery,
    replaceQuery,
    matchCount,
    currentMatchIndex,
    totalMatches,
    onTabChange,
    onSearchQueryChange,
    onReplaceQueryChange,
    onFindNext,
    onCount,
    onReplace,
    onReplaceAll,
    onClose,
}: FindReplaceDialogProps) {
    const searchInputRef = useRef<HTMLInputElement>(null);
    const replaceInputRef = useRef<HTMLInputElement>(null);
    const { dialogRef, position, isDragging, handleDragMouseDown } = useDraggableDialog(open, {
        initialPosition: { x: 0, y: 50 },
        positionStrategy: 'top-right',
    });
    const [isDialogFocused, setIsDialogFocused] = useState(true);

    // Switch to Find tab if mode changes to preview while on Replace tab
    useEffect(() => {
        if (mode === 'preview' && activeTab === 'replace') {
            onTabChange('find');
        }
    }, [mode, activeTab, onTabChange]);

    // Focus search input when dialog opens or tab changes
    useEffect(() => {
        if (open) {
            requestAnimationFrame(() => {
                searchInputRef.current?.focus();
                setIsDialogFocused(true);
            });
        }
    }, [open, activeTab]);

    // Handle focus/blur events to change opacity
    useEffect(() => {
        const handleFocusIn = (e: FocusEvent) => {
            // Check if the focus is within the dialog
            if (dialogRef.current && dialogRef.current.contains(e.target as Node)) {
                setIsDialogFocused(true);
            }
        };

        const handleFocusOut = (e: FocusEvent) => {
            // Check if the new focus is outside the dialog
            if (dialogRef.current && !dialogRef.current.contains(e.relatedTarget as Node)) {
                setIsDialogFocused(false);
            }
        };

        const handleMouseDown = (e: MouseEvent) => {
            // Check if clicking outside the dialog
            if (dialogRef.current && !dialogRef.current.contains(e.target as Node)) {
                setIsDialogFocused(false);
            } else if (dialogRef.current && dialogRef.current.contains(e.target as Node)) {
                setIsDialogFocused(true);
            }
        };

        if (open) {
            document.addEventListener('focusin', handleFocusIn);
            document.addEventListener('focusout', handleFocusOut);
            document.addEventListener('mousedown', handleMouseDown);

            return () => {
                document.removeEventListener('focusin', handleFocusIn);
                document.removeEventListener('focusout', handleFocusOut);
                document.removeEventListener('mousedown', handleMouseDown);
            };
        }
    }, [open]);

    const handleSearchKeyDown = useCallback((e: React.KeyboardEvent) => {
        if (e.key === 'Enter') {
            onFindNext();
        } else if (e.key === 'Escape') {
            onClose();
        }
    }, [onFindNext, onClose]);

    const handleReplaceKeyDown = useCallback((e: React.KeyboardEvent) => {
        if (e.key === 'Enter') {
            onReplace();
        } else if (e.key === 'Escape') {
            onClose();
        }
    }, [onReplace, onClose]);

    const handleTabChange = useCallback((_event: React.SyntheticEvent, newValue: number) => {
        onTabChange(newValue === 0 ? 'find' : 'replace');
    }, [onTabChange]);

    if (!open) return null;

    const isPreviewMode = mode === 'preview';

    const renderStatusText = () => {
        if (matchCount === null) return null;

        if (matchCount === 0) {
            return (
                <Typography variant="body2" color="text.secondary">
                    No matches found
                </Typography>
            );
        }

        if (activeTab === 'find') {
            return (
                <Typography variant="body2" color="text.secondary">
                    {matchCount} occurrence{matchCount !== 1 ? 's' : ''} found
                </Typography>
            );
        }

        // Replace tab - show current position
        if (currentMatchIndex >= 0 && totalMatches > 0) {
            return (
                <Typography variant="body2" color="text.secondary">
                    {currentMatchIndex + 1} of {totalMatches} matches
                </Typography>
            );
        }

        return (
            <Typography variant="body2" color="text.secondary">
                {matchCount} occurrence{matchCount !== 1 ? 's' : ''} found
            </Typography>
        );
    };

    return (
        <DialogContainer
            ref={dialogRef}
            sx={{
                left: position.x,
                top: position.y,
                cursor: isDragging ? 'grabbing' : 'default',
                opacity: isDialogFocused ? 1 : 0.6,
                transition: 'opacity 0.2s ease-in-out',
            }}
        >
            <DragHandle onMouseDown={handleDragMouseDown}>
                <DragIndicatorIcon fontSize="small" sx={{ color: 'text.secondary' }} />
            </DragHandle>
            <StyledTabs
                value={activeTab === 'find' ? 0 : 1}
                onChange={handleTabChange}
            >
                <StyledTab label="Find" />
                <StyledTab 
                    label="Replace" 
                    disabled={isPreviewMode}
                    title={isPreviewMode ? "Switch to edit mode to replace" : undefined}
                />
            </StyledTabs>

            <DialogContent>
                {activeTab === 'find' ? (
                    // Find Tab
                    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                        <TextField
                            inputRef={searchInputRef}
                            autoFocus
                            size="small"
                            placeholder="Find what:"
                            value={searchQuery}
                            onChange={(e) => onSearchQueryChange(e.target.value)}
                            onKeyDown={handleSearchKeyDown}
                            fullWidth
                            InputProps={{
                                sx: {
                                    '& input::placeholder': {
                                        color: 'text.secondary',
                                        opacity: 1,
                                    },
                                },
                            }}
                        />
                        <Box sx={{ display: 'flex', gap: 1 }}>
                            <Button
                                variant="contained"
                                size="small"
                                onClick={onFindNext}
                                disabled={!searchQuery}
                            >
                                Find Next
                            </Button>
                            <Button
                                variant="outlined"
                                size="small"
                                onClick={onCount}
                                disabled={!searchQuery}
                            >
                                Count
                            </Button>
                            <IconButton size="small" onClick={onClose}>
                                <CloseIcon fontSize="small" />
                            </IconButton>
                        </Box>
                        {renderStatusText()}
                    </Box>
                ) : (
                    // Replace Tab
                    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                        <TextField
                            inputRef={searchInputRef}
                            autoFocus
                            size="small"
                            placeholder="Find what:"
                            value={searchQuery}
                            onChange={(e) => onSearchQueryChange(e.target.value)}
                            onKeyDown={handleSearchKeyDown}
                            fullWidth
                            InputProps={{
                                sx: {
                                    '& input::placeholder': {
                                        color: 'text.secondary',
                                        opacity: 1,
                                    },
                                },
                            }}
                        />
                        <TextField
                            inputRef={replaceInputRef}
                            size="small"
                            placeholder="Replace with:"
                            value={replaceQuery}
                            onChange={(e) => onReplaceQueryChange(e.target.value)}
                            onKeyDown={handleReplaceKeyDown}
                            fullWidth
                            InputProps={{
                                sx: {
                                    '& input::placeholder': {
                                        color: 'text.secondary',
                                        opacity: 1,
                                    },
                                },
                            }}
                        />
                        <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                            <Button
                                variant="contained"
                                size="small"
                                onClick={onFindNext}
                                disabled={!searchQuery}
                            >
                                Find Next
                            </Button>
                            <Button
                                variant="outlined"
                                size="small"
                                onClick={onReplace}
                                disabled={!searchQuery}
                            >
                                Replace
                            </Button>
                            <Button
                                variant="outlined"
                                size="small"
                                onClick={onReplaceAll}
                                disabled={!searchQuery}
                            >
                                Replace All
                            </Button>
                            <IconButton size="small" onClick={onClose}>
                                <CloseIcon fontSize="small" />
                            </IconButton>
                        </Box>
                        {renderStatusText()}
                    </Box>
                )}
            </DialogContent>
        </DialogContainer>
    );
}
