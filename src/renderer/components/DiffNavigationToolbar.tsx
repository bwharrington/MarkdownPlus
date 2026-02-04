import React from 'react';
import { Box, IconButton, Button, Typography, Divider, styled, Tooltip } from '@mui/material';
import KeyboardArrowUpIcon from '@mui/icons-material/KeyboardArrowUp';
import KeyboardArrowDownIcon from '@mui/icons-material/KeyboardArrowDown';
import CheckIcon from '@mui/icons-material/Check';
import UndoIcon from '@mui/icons-material/Undo';
import CloseIcon from '@mui/icons-material/Close';
import DoneAllIcon from '@mui/icons-material/DoneAll';

interface DiffNavigationToolbarProps {
    currentIndex: number;
    totalCount: number;
    pendingCount: number;
    summary?: string;
    onPrevious: () => void;
    onNext: () => void;
    onAcceptCurrent: () => void;
    onRejectCurrent: () => void;
    onAcceptAll: () => void;
    onCancel: () => void;
}

const ToolbarContainer = styled(Box)(({ theme }) => ({
    position: 'absolute',
    bottom: 16,
    right: 16,
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    backgroundColor: theme.palette.background.paper,
    borderRadius: 8,
    boxShadow: theme.shadows[4],
    padding: '8px 12px',
    zIndex: 1000,
}));

const NavigationGroup = styled(Box)({
    display: 'flex',
    alignItems: 'center',
    gap: 4,
});

const ActionGroup = styled(Box)({
    display: 'flex',
    alignItems: 'center',
    gap: 4,
});

const StyledDivider = styled(Divider)({
    height: 24,
    margin: '0 4px',
});

const CountText = styled(Typography)(({ theme }) => ({
    minWidth: 48,
    textAlign: 'center',
    fontSize: '0.875rem',
    color: theme.palette.text.secondary,
}));

const KeepButton = styled(Button)(({ theme }) => ({
    textTransform: 'none',
    minWidth: 60,
    fontSize: '0.8rem',
    padding: '4px 8px',
}));

const KeepAllButton = styled(Button)(({ theme }) => ({
    textTransform: 'none',
    fontSize: '0.8rem',
    padding: '4px 12px',
}));

export function DiffNavigationToolbar({
    currentIndex,
    totalCount,
    pendingCount,
    summary,
    onPrevious,
    onNext,
    onAcceptCurrent,
    onRejectCurrent,
    onAcceptAll,
    onCancel,
}: DiffNavigationToolbarProps) {
    const hasPending = pendingCount > 0;
    const isCurrentPending = currentIndex >= 0 && currentIndex < totalCount;

    return (
        <ToolbarContainer>
            {/* Navigation */}
            <NavigationGroup>
                <Tooltip title="Previous change (K)">
                    <span>
                        <IconButton
                            size="small"
                            onClick={onPrevious}
                            disabled={currentIndex <= 0}
                        >
                            <KeyboardArrowUpIcon />
                        </IconButton>
                    </span>
                </Tooltip>
                <CountText>
                    {totalCount > 0 ? `${currentIndex + 1} / ${totalCount}` : '0 / 0'}
                </CountText>
                <Tooltip title="Next change (J)">
                    <span>
                        <IconButton
                            size="small"
                            onClick={onNext}
                            disabled={currentIndex >= totalCount - 1}
                        >
                            <KeyboardArrowDownIcon />
                        </IconButton>
                    </span>
                </Tooltip>
            </NavigationGroup>

            <StyledDivider orientation="vertical" flexItem />

            {/* Current hunk actions */}
            <ActionGroup>
                <Tooltip title="Keep this change (Enter)">
                    <span>
                        <KeepButton
                            size="small"
                            color="success"
                            variant="outlined"
                            startIcon={<CheckIcon fontSize="small" />}
                            onClick={onAcceptCurrent}
                            disabled={!isCurrentPending}
                        >
                            Keep
                        </KeepButton>
                    </span>
                </Tooltip>
                <Tooltip title="Undo this change (Backspace)">
                    <span>
                        <KeepButton
                            size="small"
                            color="error"
                            variant="outlined"
                            startIcon={<UndoIcon fontSize="small" />}
                            onClick={onRejectCurrent}
                            disabled={!isCurrentPending}
                        >
                            Undo
                        </KeepButton>
                    </span>
                </Tooltip>
            </ActionGroup>

            <StyledDivider orientation="vertical" flexItem />

            {/* Bulk actions */}
            <ActionGroup>
                <Tooltip title="Keep all pending changes">
                    <span>
                        <KeepAllButton
                            size="small"
                            variant="contained"
                            color="success"
                            startIcon={<DoneAllIcon fontSize="small" />}
                            onClick={onAcceptAll}
                            disabled={!hasPending}
                        >
                            Keep All ({pendingCount})
                        </KeepAllButton>
                    </span>
                </Tooltip>
                <Tooltip title="Cancel and discard all changes (Escape)">
                    <IconButton size="small" onClick={onCancel}>
                        <CloseIcon />
                    </IconButton>
                </Tooltip>
            </ActionGroup>
        </ToolbarContainer>
    );
}
