import React, { useCallback } from 'react';
import { Box, TextField, Button, IconButton, CircularProgress, styled } from '@mui/material';
import { AttachFileIcon, SendIcon, EditIcon, ResearchIcon } from './AppIcons';
import type { AIChatMode } from '../types/global';

const InputContainer = styled(Box)(({ theme }) => ({
    display: 'flex',
    gap: 8,
    padding: 12,
    borderTop: `1px solid ${theme.palette.divider}`,
    backgroundColor: theme.palette.background.paper,
}));

interface MessageInputProps {
    inputRef: React.RefObject<HTMLTextAreaElement | null>;
    inputValue: string;
    mode: AIChatMode;
    isLoading: boolean;
    isEditLoading: boolean;
    isResearchLoading: boolean;
    hasDiffTab: boolean;
    hasActiveRequest: boolean;
    onInputChange: (value: string) => void;
    onSend: () => void;
    onCancel: () => void;
    onAttachFile: () => void;
    onClose: () => void;
}

export function MessageInput({
    inputRef,
    inputValue,
    mode,
    isLoading,
    isEditLoading,
    isResearchLoading,
    hasDiffTab,
    hasActiveRequest,
    onInputChange,
    onSend,
    onCancel,
    onAttachFile,
    onClose,
}: MessageInputProps) {
    const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            onSend();
        } else if (e.key === 'Escape') {
            onClose();
        }
    }, [onSend, onClose]);

    return (
        <InputContainer>
            <IconButton
                size="small"
                onClick={onAttachFile}
                disabled={isLoading}
                title="Attach files"
                sx={{ color: 'text.secondary' }}
            >
                <AttachFileIcon fontSize="small" />
            </IconButton>
            <TextField
                inputRef={inputRef}
                multiline
                maxRows={4}
                size="small"
                placeholder={
                    mode === 'edit'
                        ? "Describe the changes you want... (e.g., 'Add a table of contents')"
                        : mode === 'research'
                            ? "Enter a research topic... (e.g., 'Vector search in production')"
                            : "Type a message... (Enter to send, Shift+Enter for newline)"
                }
                value={inputValue}
                onChange={(e) => onInputChange(e.target.value)}
                onKeyDown={handleKeyDown}
                fullWidth
                disabled={isLoading || isEditLoading || isResearchLoading || hasDiffTab}
                slotProps={{
                    input: {
                        sx: { fontSize: '0.875rem' }
                    }
                }}
            />
            <Button
                variant="outlined"
                size="small"
                onClick={onCancel}
                disabled={!hasActiveRequest}
                color="warning"
                sx={{ minWidth: 'auto', px: 2 }}
            >
                Cancel
            </Button>
            <Button
                variant="contained"
                size="small"
                onClick={onSend}
                disabled={!inputValue.trim() || isLoading || isEditLoading || isResearchLoading || hasDiffTab}
                color={mode === 'edit' ? 'success' : mode === 'research' ? 'info' : 'primary'}
                sx={{ minWidth: 'auto', px: 2 }}
            >
                {(isEditLoading || isResearchLoading) ? (
                    <CircularProgress size={18} color="inherit" />
                ) : mode === 'edit' ? (
                    <EditIcon fontSize="small" />
                ) : mode === 'research' ? (
                    <ResearchIcon fontSize="small" />
                ) : (
                    <SendIcon fontSize="small" />
                )}
            </Button>
        </InputContainer>
    );
}
