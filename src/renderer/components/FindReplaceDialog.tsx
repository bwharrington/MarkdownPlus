import React, { useRef, useEffect } from 'react';
import { Box, styled, TextField, Button, IconButton, Typography, Tabs, Tab, Tooltip } from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';

const DialogContainer = styled(Box)(({ theme }) => ({
    position: 'absolute',
    top: 50,
    right: 16,
    zIndex: 1000,
    backgroundColor: theme.palette.background.paper,
    border: `1px solid ${theme.palette.divider}`,
    borderRadius: 4,
    boxShadow: theme.shadows[4],
    minWidth: 320,
    overflow: 'hidden',
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

    // Focus search input when dialog opens or tab changes
    useEffect(() => {
        if (open) {
            requestAnimationFrame(() => {
                searchInputRef.current?.focus();
            });
        }
    }, [open, activeTab]);

    if (!open) return null;

    const isPreviewMode = mode === 'preview';
    const canReplace = !isPreviewMode && searchQuery;

    const handleSearchKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter') {
            onFindNext();
        } else if (e.key === 'Escape') {
            onClose();
        }
    };

    const handleReplaceKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter') {
            onReplace();
        } else if (e.key === 'Escape') {
            onClose();
        }
    };

    const handleTabChange = (_event: React.SyntheticEvent, newValue: number) => {
        onTabChange(newValue === 0 ? 'find' : 'replace');
    };

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
        <DialogContainer>
            <StyledTabs
                value={activeTab === 'find' ? 0 : 1}
                onChange={handleTabChange}
            >
                <StyledTab label="Find" />
                <StyledTab label="Replace" />
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
                            <Tooltip title={isPreviewMode ? "Switch to edit mode to replace" : ""}>
                                <span>
                                    <Button
                                        variant="outlined"
                                        size="small"
                                        onClick={onReplace}
                                        disabled={!canReplace}
                                    >
                                        Replace
                                    </Button>
                                </span>
                            </Tooltip>
                            <Tooltip title={isPreviewMode ? "Switch to edit mode to replace" : ""}>
                                <span>
                                    <Button
                                        variant="outlined"
                                        size="small"
                                        onClick={onReplaceAll}
                                        disabled={!canReplace}
                                    >
                                        Replace All
                                    </Button>
                                </span>
                            </Tooltip>
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
