import React, { useCallback } from 'react';
import { Box, IconButton, styled } from '@mui/material';
import { CheckIcon, UndoIcon } from './AppIcons';

interface DiffHunkControlProps {
    hunkId: string;
    position: { top: number; right: number };
    onAccept: () => void;
    onReject: () => void;
}

const ControlContainer = styled(Box)(({ theme }) => ({
    position: 'absolute',
    display: 'flex',
    gap: 4,
    backgroundColor: theme.palette.background.paper,
    borderRadius: 4,
    boxShadow: theme.shadows[2],
    padding: 2,
    zIndex: 100,
}));

const AcceptButton = styled(IconButton)(({ theme }) => ({
    padding: 4,
    color: theme.palette.success.main,
    '&:hover': {
        backgroundColor: theme.palette.success.main + '1A', // 10% opacity
    },
}));

const RejectButton = styled(IconButton)(({ theme }) => ({
    padding: 4,
    color: theme.palette.error.main,
    '&:hover': {
        backgroundColor: theme.palette.error.main + '1A', // 10% opacity
    },
}));

export const DiffHunkControl = React.memo(function DiffHunkControl({ hunkId, position, onAccept, onReject }: DiffHunkControlProps) {
    const handleAcceptClick = useCallback((e: React.MouseEvent) => {
        e.stopPropagation();
        onAccept();
    }, [onAccept]);

    const handleRejectClick = useCallback((e: React.MouseEvent) => {
        e.stopPropagation();
        onReject();
    }, [onReject]);

    return (
        <ControlContainer
            sx={{
                top: position.top,
                right: position.right,
            }}
            data-hunk-id={hunkId}
        >
            <AcceptButton
                size="small"
                onClick={handleAcceptClick}
                title="Keep this change"
            >
                <CheckIcon fontSize="small" />
            </AcceptButton>
            <RejectButton
                size="small"
                onClick={handleRejectClick}
                title="Undo this change"
            >
                <UndoIcon fontSize="small" />
            </RejectButton>
        </ControlContainer>
    );
});
