import React, { useEffect } from 'react';
import { Snackbar, Alert, Button, IconButton, Box, Typography, styled, keyframes } from '@mui/material';
import { CloseIcon } from './AppIcons';
import { useEditorState, useEditorDispatch } from '../contexts';

// --- Go Deeper toast styles ---

const borderSpin = keyframes`
    0%   { '--gd-toast-angle': '0deg' }
    100% { '--gd-toast-angle': '360deg' }
`;

const GoDeepToastRoot = styled(Box)({
    '@property --gd-toast-angle': {
        syntax: '"<angle>"',
        inherits: 'false',
        initialValue: '0deg',
    },
    position: 'relative',
    borderRadius: 8,
    padding: '12px 16px',
    minWidth: 288,
    maxWidth: 480,
    backgroundColor: '#ffffff',
    color: '#111111',
    display: 'flex',
    alignItems: 'flex-start',
    gap: 10,
    boxSizing: 'border-box',
    zIndex: 0,
    '&::before': {
        content: '""',
        position: 'absolute',
        inset: -2,
        borderRadius: 10,
        padding: '2px',
        background: 'conic-gradient(from var(--gd-toast-angle), #0A68C8, #40D0FF, #78E8FF, #FFFFFF, #F4D878, #E8B830, #C8810A, #E8B830, #F4D878, #FFFFFF, #78E8FF, #40D0FF, #0A68C8)',
        WebkitMask: 'linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0)',
        WebkitMaskComposite: 'xor',
        maskComposite: 'exclude',
        animation: `${borderSpin} 3s linear infinite`,
        zIndex: -1,
    },
});

const GoDeepToastText = styled(Typography)({
    fontSize: '0.875rem',
    fontWeight: 500,
    color: '#111111',
    lineHeight: 1.4,
    flex: 1,
});

const GoDeepToastClose = styled(IconButton)({
    padding: 2,
    marginTop: -2,
    color: '#555555',
    flexShrink: 0,
});

// --- Component ---

export function NotificationSnackbar() {
    const state = useEditorState();
    const dispatch = useEditorDispatch();

    const currentNotification = state.notifications[0];
    const dismissTimeout = currentNotification?.action ? 15000 : 5000;

    useEffect(() => {
        if (currentNotification) {
            const timer = setTimeout(() => {
                dispatch({
                    type: 'DISMISS_NOTIFICATION',
                    payload: { id: currentNotification.id },
                });
            }, dismissTimeout);

            return () => clearTimeout(timer);
        }
    }, [currentNotification, dismissTimeout, dispatch]);

    const handleClose = () => {
        if (currentNotification) {
            dispatch({
                type: 'DISMISS_NOTIFICATION',
                payload: { id: currentNotification.id },
            });
        }
    };

    const isGoDeeper = currentNotification?.variant === 'go-deeper';

    return (
        <Snackbar
            open={!!currentNotification}
            autoHideDuration={dismissTimeout}
            onClose={handleClose}
            anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
        >
            {currentNotification ? (
                isGoDeeper ? (
                    <GoDeepToastRoot>
                        <GoDeepToastText>{currentNotification.message}</GoDeepToastText>
                        <GoDeepToastClose size="small" onClick={handleClose} aria-label="close">
                            <CloseIcon size={16} />
                        </GoDeepToastClose>
                    </GoDeepToastRoot>
                ) : (
                    <Alert
                        onClose={currentNotification.action ? undefined : handleClose}
                        severity={currentNotification.severity}
                        variant="filled"
                        sx={{ width: '100%' }}
                        action={currentNotification.action ? (
                            <>
                                <Button
                                    color="inherit"
                                    size="small"
                                    onClick={currentNotification.action.onClick}
                                >
                                    {currentNotification.action.label}
                                </Button>
                                <IconButton
                                    color="inherit"
                                    size="small"
                                    onClick={handleClose}
                                    aria-label="close"
                                >
                                    <CloseIcon size={18} />
                                </IconButton>
                            </>
                        ) : undefined}
                    >
                        {currentNotification.message}
                    </Alert>
                )
            ) : undefined}
        </Snackbar>
    );
}
