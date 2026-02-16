import React, { useEffect } from 'react';
import { Snackbar, Alert, Button, IconButton } from '@mui/material';
import { CloseIcon } from './AppIcons';
import { useEditorState, useEditorDispatch } from '../contexts';

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

    return (
        <Snackbar
            open={!!currentNotification}
            autoHideDuration={dismissTimeout}
            onClose={handleClose}
            anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
        >
            {currentNotification ? (
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
            ) : undefined}
        </Snackbar>
    );
}
