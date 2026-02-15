import React from 'react';
import { Box, Typography, CircularProgress, styled } from '@mui/material';
import ReactMarkdown from 'react-markdown';
import type { AIMessage } from '../hooks/useAIChat';

const MessagesContainer = styled(Box)(({ theme }) => ({
    flex: 1,
    overflowY: 'auto',
    padding: 12,
    display: 'flex',
    flexDirection: 'column',
    gap: 12,
    backgroundColor: theme.palette.mode === 'dark'
        ? theme.palette.grey[900]
        : theme.palette.grey[50],
}));

const MessageBubble = styled(Box)<{ role: 'user' | 'assistant' }>(({ theme, role }) => ({
    padding: '10px 14px',
    borderRadius: 12,
    maxWidth: '85%',
    alignSelf: role === 'user' ? 'flex-end' : 'flex-start',
    backgroundColor: role === 'user'
        ? theme.palette.primary.main
        : theme.palette.mode === 'dark'
            ? theme.palette.grey[800]
            : theme.palette.grey[200],
    color: role === 'user'
        ? theme.palette.primary.contrastText
        : theme.palette.text.primary,
    wordBreak: 'break-word',
    '& p': {
        margin: 0,
    },
    '& p + p': {
        marginTop: 8,
    },
    '& pre': {
        backgroundColor: theme.palette.mode === 'dark'
            ? 'rgba(0,0,0,0.3)'
            : 'rgba(0,0,0,0.05)',
        padding: 8,
        borderRadius: 4,
        overflowX: 'auto',
        margin: '8px 0',
    },
    '& code': {
        fontFamily: 'monospace',
        fontSize: '0.9em',
    },
    '& ul, & ol': {
        marginLeft: 16,
        marginTop: 4,
        marginBottom: 4,
    },
}));

const GreetingContainer = styled(Box)({
    textAlign: 'center',
    paddingTop: 32,
    paddingBottom: 32,
});

const ChatLoadingContainer = styled(Box)({
    display: 'flex',
    justifyContent: 'center',
    paddingTop: 16,
    paddingBottom: 16,
});

const EditLoadingContainer = styled(Box)({
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    paddingTop: 16,
    paddingBottom: 16,
    gap: 8,
});

const LoadingCursor = styled(Box)(({ theme }) => ({
    display: 'inline-block',
    width: '2px',
    height: '1em',
    backgroundColor: theme.palette.text.secondary,
    marginLeft: '1px',
    verticalAlign: 'text-bottom',
    '@keyframes blink': {
        '0%, 100%': { opacity: 1 },
        '50%': { opacity: 0 },
    },
    animation: 'blink 1s step-end infinite',
}));

const DiffTabBanner = styled(Box)(({ theme }) => ({
    textAlign: 'center',
    paddingTop: 8,
    paddingBottom: 8,
    paddingLeft: 16,
    paddingRight: 16,
    backgroundColor: theme.palette.success.main,
    color: theme.palette.success.contrastText,
    borderRadius: 4,
}));

interface ChatMessagesProps {
    messages: AIMessage[];
    greeting: string;
    isLoading: boolean;
    isEditLoading: boolean;
    hasDiffTab: boolean;
    loadingDisplayText: string;
    error: string | null;
    editModeError: string | null;
    messagesEndRef: React.RefObject<HTMLDivElement | null>;
}

export function ChatMessages({
    messages,
    greeting,
    isLoading,
    isEditLoading,
    hasDiffTab,
    loadingDisplayText,
    error,
    editModeError,
    messagesEndRef,
}: ChatMessagesProps) {
    const showGreeting = messages.length === 0 && !isLoading && !isEditLoading && !hasDiffTab;

    return (
        <MessagesContainer>
            {showGreeting ? (
                <GreetingContainer>
                    <Typography color="text.secondary" variant="body2" sx={{ fontStyle: 'italic' }}>
                        {greeting}
                    </Typography>
                </GreetingContainer>
            ) : (
                messages.map((msg, idx) => (
                    <MessageBubble key={idx} role={msg.role}>
                        {msg.role === 'assistant' ? (
                            <ReactMarkdown>{msg.content}</ReactMarkdown>
                        ) : (
                            <Typography variant="body2">{msg.content}</Typography>
                        )}
                    </MessageBubble>
                ))
            )}
            {isLoading && (
                <ChatLoadingContainer>
                    <CircularProgress size={24} />
                </ChatLoadingContainer>
            )}
            {isEditLoading && (
                <EditLoadingContainer>
                    <CircularProgress size={24} color="success" />
                    <Typography
                        variant="body2"
                        color="text.secondary"
                        sx={{
                            fontFamily: 'monospace',
                            minHeight: '1.5em',
                            textAlign: 'center',
                        }}
                    >
                        {loadingDisplayText}
                        <LoadingCursor />
                    </Typography>
                </EditLoadingContainer>
            )}
            {error && (
                <Typography color="error" variant="body2" sx={{ textAlign: 'center' }}>
                    {error}
                </Typography>
            )}
            {editModeError && (
                <Typography color="error" variant="body2" sx={{ textAlign: 'center' }}>
                    {editModeError}
                </Typography>
            )}
            {hasDiffTab && (
                <DiffTabBanner>
                    <Typography variant="body2">
                        AI diff tab open - review changes there
                    </Typography>
                </DiffTabBanner>
            )}
            <div ref={messagesEndRef} />
        </MessagesContainer>
    );
}
