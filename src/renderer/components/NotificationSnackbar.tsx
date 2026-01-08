import React, { useEffect } from 'react';
import { Snackbar, Alert } from '@mui/material';
import { useEditorState, useEditorDispatch } from '../contexts';

export function NotificationSnackbar() {
    const state = useEditorState();
    const dispatch = useEditorDispatch();

    const currentNotification = state.notifications[0];

    useEffect(() => {
        if (currentNotification) {
            const timer = setTimeout(() => {
                dispatch({
                    type: 'DISMISS_NOTIFICATION',
                    payload: { id: currentNotification.id },
                });
            }, 5000);

            return () => clearTimeout(timer);
        }
    }, [currentNotification, dispatch]);

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
            autoHideDuration={5000}
            onClose={handleClose}
            anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
        >
            {currentNotification ? (
                <Alert
                    onClose={handleClose}
                    severity={currentNotification.severity}
                    variant="filled"
                    sx={{ width: '100%' }}
                >
                    {currentNotification.message}
                </Alert>
            ) : undefined}
        </Snackbar>
    );
}
