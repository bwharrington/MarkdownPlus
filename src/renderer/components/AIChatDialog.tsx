import React, { useRef, useEffect, useState, useCallback } from 'react';
import {
    Box,
    styled,
    TextField,
    Button,
    IconButton,
    Typography,
    Select,
    MenuItem,
    FormControl,
    InputLabel,
    CircularProgress,
    Chip,
    Tooltip,
    Dialog,
    DialogTitle,
    DialogContent,
    DialogContentText,
    DialogActions,
} from '@mui/material';
import {
    CloseIcon,
    SendIcon,
    DeleteOutlineIcon,
    ExpandLessIcon,
    ExpandMoreIcon,
    AttachFileIcon,
    EditIcon,
    WarningAmberIcon,
    VisibilityIcon,
    VisibilityOffIcon,
} from './AppIcons';
import ReactMarkdown from 'react-markdown';
import { useAIChat, AIProvider } from '../hooks';
import { useAIDiffEdit } from '../hooks/useAIDiffEdit';
import { useEditLoadingMessage } from '../hooks/useEditLoadingMessage';
import { useEditorState, useEditorDispatch } from '../contexts/EditorContext';

const DialogContainer = styled(Box)(({ theme }) => ({
    position: 'relative',
    backgroundColor: theme.palette.background.paper,
    borderLeft: `1px solid ${theme.palette.divider}`,
    overflow: 'hidden',
    display: 'flex',
    flexDirection: 'column',
    width: '100%',
    height: '100%',
}));

const PanelHeader = styled(Box)(({ theme }) => ({
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '8px 12px',
    backgroundColor: theme.palette.action.hover,
    borderBottom: `1px solid ${theme.palette.divider}`,
}));

const HeaderControls = styled(Box)({
    display: 'flex',
    alignItems: 'center',
    gap: 8,
});

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

const InputContainer = styled(Box)(({ theme }) => ({
    display: 'flex',
    gap: 8,
    padding: 12,
    borderTop: `1px solid ${theme.palette.divider}`,
    backgroundColor: theme.palette.background.paper,
}));

const SelectorsContainer = styled(Box)(({ theme }) => ({
    display: 'flex',
    gap: 8,
    padding: '8px 12px',
    borderBottom: `1px solid ${theme.palette.divider}`,
}));

const StatusDot = styled('span')<{ status: string }>(({ status }) => ({
    display: 'inline-block',
    width: 8,
    height: 8,
    borderRadius: '50%',
    marginRight: 6,
    backgroundColor: status === 'success' ? '#4caf50'
        : status === 'error' ? '#f44336'
        : status === 'checking' ? '#ff9800'
        : '#9e9e9e',
}));

const AttachmentsContainer = styled(Box)(({ theme }) => ({
    display: 'flex',
    flexWrap: 'wrap',
    gap: 6,
    padding: '8px 12px',
    borderTop: `1px solid ${theme.palette.divider}`,
    backgroundColor: theme.palette.action.hover,
    maxHeight: 100,
    overflowY: 'auto',
}));

// Keyframes for glow animation
const glowAnimation = `
    @keyframes chipGlow {
        0%, 100% {
            box-shadow: 0 0 2px rgba(33, 150, 243, 0.3);
        }
        50% {
            box-shadow: 0 0 12px rgba(33, 150, 243, 0.8), 0 0 20px rgba(33, 150, 243, 0.4);
        }
    }
`;

interface AIChatDialogProps {
    open: boolean;
    onClose: () => void;
}

interface AttachedFile {
    name: string;
    path: string;
    type: string;
    size: number;
    isContextDoc?: boolean; // True if this is the current document
    enabled?: boolean; // True if context doc is enabled (default true)
}

export function AIChatDialog({ open, onClose }: AIChatDialogProps) {
    const dialogRef = useRef<HTMLDivElement>(null);
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLTextAreaElement>(null);
    const editorState = useEditorState();
    const dispatch = useEditorDispatch();

    // Random greeting (stable for session lifetime)
    const [greeting] = useState(() => {
        const greetings = [
            "I'll be back\u2026 right after you say something.",
            "You have 20 seconds to comply. Chat now.",
            "I'm sorry, Dave. I'm afraid I can talk\u2026 if you start.",
            "Number 5 is alive! Your move, human.",
            "Come with me if you want to chat.",
            "I've seen chat things you people wouldn't believe.",
            "There is no spoon. There is only chat. Begin.",
            "Hello, I am Baymax. On a scale of 1\u201310, how chatty are you?",
            "Sir, the conversation is ready.",
            "Eva? \u2026No, but I'm still here. Talk to me.",
            "You are the one\u2026 who needs to type first.",
            "Resistance is futile. Start typing.",
            "More than meets the eye\u2026 and ready to talk.",
            "The cake is a lie. This chat is not.",
            "Dead or alive, you're chatting with me.",
            "Human detected. Beep boop. Your turn.",
            "I'm more machine now than man\u2026 but I still love a good chat.",
            "Let's make the robots jealous. Start now.",
            "I am Groot\u2026 and I want to chat.",
            "The machines are listening. Impress them.",
        ];
        return greetings[Math.floor(Math.random() * greetings.length)];
    });

    // Collapse/Expand state
    const [isCollapsed, setIsCollapsed] = useState(false);

    // File attachments state
    const [attachedFiles, setAttachedFiles] = useState<AttachedFile[]>([]);
    const [glowingFile, setGlowingFile] = useState<string | null>(null);

    // Edit mode state - persisted in config
    const [isEditMode, setIsEditMode] = useState(editorState.config.aiChatEditMode ?? false);
    const [editModeError, setEditModeError] = useState<string | null>(null);
    const [isEditLoading, setIsEditLoading] = useState(false);
    const activeEditRequestIdRef = useRef<string | null>(null);
    const [clearConfirmOpen, setClearConfirmOpen] = useState(false);

    // AI Diff Edit hook
    const { requestEdit, hasDiffTab } = useAIDiffEdit();

    // Rotating loading messages with typewriter effect
    const { displayText: loadingDisplayText } = useEditLoadingMessage(isEditLoading);

    const {
        provider,
        setProvider,
        providerStatuses,
        getProviderOptions,
        models,
        selectedModel,
        setSelectedModel,
        isLoadingModels,
        messages,
        inputValue,
        setInputValue,
        isLoading,
        error,
        sendMessage,
        cancelCurrentRequest,
        clearChat,
    } = useAIChat({
        savedProvider: editorState.config.aiChatProvider,
        savedModel: editorState.config.aiChatModel,
    });

    // Persist config helper
    const persistConfig = useCallback((updates: Record<string, unknown>) => {
        const nextConfig = { ...editorState.config, ...updates };
        dispatch({ type: 'SET_CONFIG', payload: nextConfig });
        void window.electronAPI.saveConfig(nextConfig).catch((err) => {
            console.error('Failed to save AI chat config:', err);
        });
    }, [dispatch, editorState.config]);

    // Persist edit mode to config
    const handleModeChange = useCallback((editMode: boolean) => {
        setIsEditMode(editMode);
        persistConfig({ aiChatEditMode: editMode });
    }, [persistConfig]);

    // Persist provider selection
    const handleProviderChange = useCallback((newProvider: AIProvider) => {
        setProvider(newProvider);
        persistConfig({ aiChatProvider: newProvider });
    }, [setProvider, persistConfig]);

    // Persist model selection
    const handleModelChange = useCallback((newModel: string) => {
        setSelectedModel(newModel);
        persistConfig({ aiChatModel: newModel });
    }, [setSelectedModel, persistConfig]);

    // Focus input when dialog opens
    useEffect(() => {
        if (open) {
            requestAnimationFrame(() => {
                inputRef.current?.focus();
            });
        }
    }, [open]);

    // Attach current document when dialog opens
    useEffect(() => {
        if (open && editorState.activeFileId) {
            const activeFile = editorState.openFiles.find(f => f.id === editorState.activeFileId);
            if (activeFile && activeFile.path && (activeFile.fileType === 'markdown' || activeFile.fileType === 'text')) {
                // Check if context doc is already attached
                const hasContextDoc = attachedFiles.some(f => f.isContextDoc);
                if (!hasContextDoc) {
                    const contextDoc: AttachedFile = {
                        name: activeFile.name,
                        path: activeFile.path,
                        type: activeFile.fileType,
                        size: 0,
                        isContextDoc: true,
                        enabled: true,
                    };
                    setAttachedFiles([contextDoc]);
                }
            }
        }
    }, [open, editorState.activeFileId, editorState.openFiles]);

    // Detect when context document is saved and trigger glow animation
    useEffect(() => {
        if (open && editorState.activeFileId && attachedFiles.length > 0) {
            const activeFile = editorState.openFiles.find(f => f.id === editorState.activeFileId);
            const contextDoc = attachedFiles.find(f => f.isContextDoc);

            // Check if the active file is the context document and was just saved (isDirty became false)
            if (activeFile && contextDoc && activeFile.path === contextDoc.path && !activeFile.isDirty) {
                // Trigger glow animation
                setGlowingFile(contextDoc.path);

                // Remove glow after 3 seconds
                const timeout = setTimeout(() => {
                    setGlowingFile(null);
                }, 3000);

                return () => clearTimeout(timeout);
            }
        }
    }, [open, editorState.openFiles, editorState.activeFileId, attachedFiles]);

    // Scroll to bottom when new messages arrive
    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);

    // Reset edit mode when switching to xAI (not supported)
    useEffect(() => {
        if (provider === 'xai' && isEditMode) {
            handleModeChange(false);
        }
    }, [provider, isEditMode, handleModeChange]);

    if (!open) return null;

    const providerOptions = getProviderOptions();
    const hasProviders = providerOptions.length > 0;
    const hasActiveRequest = isLoading || isEditLoading;

    // File attachment handlers
    const handleAttachFile = async () => {
        const result = await window.electronAPI.openFileDialog({
            properties: ['openFile', 'multiSelections'],
        });

        if (result && !result.canceled && result.filePaths.length > 0) {
            const newFiles: AttachedFile[] = result.filePaths.map((filePath: string) => {
                const fileName = filePath.split(/[/\\]/).pop() || filePath;
                return {
                    name: fileName,
                    path: filePath,
                    type: fileName.split('.').pop()?.toLowerCase() || 'unknown',
                    size: 0, // Will be populated when reading the file
                };
            });
            setAttachedFiles(prev => [...prev, ...newFiles]);
        }
    };

    const handleRemoveFile = (filePath: string) => {
        setAttachedFiles(prev => prev.filter(file => file.path !== filePath));
    };

    const handleToggleContextDoc = (filePath: string) => {
        setAttachedFiles(prev => prev.map(file =>
            file.path === filePath && file.isContextDoc
                ? { ...file, enabled: !file.enabled }
                : file
        ));
    };

    const handleSendMessage = async () => {
        setEditModeError(null);

        // If in edit mode and provider supports it, use the edit request
        if (isEditMode && (provider === 'claude' || provider === 'openai')) {
            setIsEditLoading(true);
            const requestId = `ai-edit-${Date.now()}-${Math.random().toString(36).slice(2)}`;
            activeEditRequestIdRef.current = requestId;
            try {
                await requestEdit(inputValue, provider, selectedModel, requestId);
                if (activeEditRequestIdRef.current !== requestId) {
                    return;
                }
                // Clear input after successful edit request
                setInputValue('');
                // Show success message in chat
                // The diff will be shown in the editor
            } catch (err) {
                if (activeEditRequestIdRef.current !== requestId) {
                    return;
                }
                setEditModeError(err instanceof Error ? err.message : 'Edit request failed');
            } finally {
                if (activeEditRequestIdRef.current === requestId) {
                    activeEditRequestIdRef.current = null;
                    setIsEditLoading(false);
                }
            }
            return;
        }

        // Regular chat mode
        const enabledFiles = attachedFiles.filter(file =>
            !file.isContextDoc || file.enabled !== false
        );
        await sendMessage(enabledFiles.length > 0 ? enabledFiles : undefined);
        // Clear only non-context files after sending
        setAttachedFiles(prev => prev.filter(file => file.isContextDoc));
    };

    const handleClearChatClick = () => {
        setClearConfirmOpen(true);
    };

    const handleCancelRequest = async () => {
        if (isLoading) {
            await cancelCurrentRequest();
            return;
        }

        if (isEditLoading) {
            const requestId = activeEditRequestIdRef.current;
            activeEditRequestIdRef.current = null;
            setIsEditLoading(false);
            setEditModeError('Edit request canceled');

            if (!requestId) {
                return;
            }

            try {
                await window.electronAPI.cancelAIEditRequest(requestId);
            } catch (err) {
                console.error('Failed to cancel AI edit request:', err);
            }
        }
    };

    const handleClearChatCancel = () => {
        setClearConfirmOpen(false);
    };

    const handleClearChatConfirm = () => {
        clearChat();
        setClearConfirmOpen(false);
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSendMessage();
        } else if (e.key === 'Escape') {
            onClose();
        }
    };

    return (
        <DialogContainer ref={dialogRef}>
            <PanelHeader>
                <HeaderControls>
                    <Typography variant="subtitle2" fontWeight={600}>
                        AI Chat
                    </Typography>
                </HeaderControls>
                <HeaderControls>
                    <IconButton size="small" onClick={() => setIsCollapsed(!isCollapsed)} title={isCollapsed ? "Expand" : "Collapse"}>
                        {isCollapsed ? <ExpandMoreIcon fontSize="small" /> : <ExpandLessIcon fontSize="small" />}
                    </IconButton>
                    {!isCollapsed && (
                        <IconButton size="small" onClick={handleClearChatClick} title="Clear chat">
                            <DeleteOutlineIcon fontSize="small" />
                        </IconButton>
                    )}
                    <IconButton size="small" onClick={onClose}>
                        <CloseIcon fontSize="small" />
                    </IconButton>
                </HeaderControls>
            </PanelHeader>

            {!isCollapsed && (!hasProviders ? (
                <Box sx={{ p: 3, textAlign: 'center' }}>
                    <Typography color="text.secondary" gutterBottom>
                        No AI providers configured
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                        Add API keys in Settings (Ctrl+,) under the "AI API Keys" section.
                    </Typography>
                </Box>
            ) : (
                <>
                    <SelectorsContainer>
                        <FormControl size="small" sx={{ minWidth: 140 }}>
                            <InputLabel>Provider</InputLabel>
                            <Select
                                value={provider}
                                label="Provider"
                                onChange={(e) => handleProviderChange(e.target.value as AIProvider)}
                                disabled={hasActiveRequest}
                            >
                                {providerOptions.map((opt) => (
                                    <MenuItem key={opt.value} value={opt.value}>
                                        <StatusDot status={opt.status} />
                                        {opt.label}
                                    </MenuItem>
                                ))}
                            </Select>
                        </FormControl>

                        <FormControl size="small" sx={{ flex: 1 }}>
                            <InputLabel>Model</InputLabel>
                            <Select
                                value={selectedModel}
                                label="Model"
                                onChange={(e) => handleModelChange(e.target.value)}
                                disabled={isLoadingModels || hasActiveRequest}
                            >
                                {models.map((model) => (
                                    <MenuItem key={model.id} value={model.id}>
                                        {model.displayName}
                                    </MenuItem>
                                ))}
                            </Select>
                        </FormControl>

                        {/* Chat/Edit mode selector */}
                        <FormControl size="small" sx={{ minWidth: 100 }}>
                            <InputLabel>Mode</InputLabel>
                            <Select
                                value={isEditMode ? 'edit' : 'chat'}
                                label="Mode"
                                onChange={(e) => handleModeChange(e.target.value === 'edit')}
                                disabled={hasDiffTab || hasActiveRequest}
                            >
                                <MenuItem value="chat">Chat</MenuItem>
                                <MenuItem
                                    value="edit"
                                    disabled={provider === 'xai'}
                                >
                                    Edit
                                </MenuItem>
                            </Select>
                        </FormControl>
                        {provider === 'xai' && isEditMode && (
                            <Tooltip title="xAI does not support edit mode. Switch to Claude or OpenAI.">
                                <WarningAmberIcon fontSize="small" color="warning" sx={{ alignSelf: 'center' }} />
                            </Tooltip>
                        )}
                    </SelectorsContainer>

                    <MessagesContainer>
                        {messages.length === 0 && !isLoading && !isEditLoading && !hasDiffTab ? (
                            <Box sx={{ textAlign: 'center', py: 4 }}>
                                <Typography color="text.secondary" variant="body2" sx={{ fontStyle: 'italic' }}>
                                    {greeting}
                                </Typography>
                            </Box>
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
                            <Box sx={{ display: 'flex', justifyContent: 'center', py: 2 }}>
                                <CircularProgress size={24} />
                            </Box>
                        )}
                        {isEditLoading && (
                            <Box sx={{
                                display: 'flex',
                                flexDirection: 'column',
                                alignItems: 'center',
                                py: 2,
                                gap: 1,
                            }}>
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
                                    <Box
                                        component="span"
                                        sx={{
                                            display: 'inline-block',
                                            width: '2px',
                                            height: '1em',
                                            backgroundColor: 'text.secondary',
                                            ml: '1px',
                                            verticalAlign: 'text-bottom',
                                            animation: 'blink 1s step-end infinite',
                                            '@keyframes blink': {
                                                '0%, 100%': { opacity: 1 },
                                                '50%': { opacity: 0 },
                                            },
                                        }}
                                    />
                                </Typography>
                            </Box>
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
                            <Box sx={{
                                textAlign: 'center',
                                py: 1,
                                px: 2,
                                backgroundColor: 'success.main',
                                color: 'success.contrastText',
                                borderRadius: 1,
                            }}>
                                <Typography variant="body2">
                                    AI diff tab open - review changes there
                                </Typography>
                            </Box>
                        )}
                        <div ref={messagesEndRef} />
                    </MessagesContainer>

                    {/* File Attachments Display */}
                    {attachedFiles.length > 0 && (
                        <>
                            <style>{glowAnimation}</style>
                            <AttachmentsContainer>
                                {attachedFiles.map((file) => {
                                    const isDisabled = file.isContextDoc && file.enabled === false;
                                    const isGlowing = glowingFile === file.path;

                                    return (
                                        <Chip
                                            key={file.path}
                                            label={file.name}
                                            size="small"
                                            title={file.path}
                                            icon={file.isContextDoc ? (
                                                isDisabled ? <VisibilityOffIcon fontSize="small" /> : <VisibilityIcon fontSize="small" />
                                            ) : undefined}
                                            onDelete={file.isContextDoc ? undefined : () => handleRemoveFile(file.path)}
                                            onClick={file.isContextDoc ? () => handleToggleContextDoc(file.path) : undefined}
                                            sx={{
                                                fontSize: '0.75rem',
                                                cursor: file.isContextDoc ? 'pointer' : 'default',
                                                opacity: isDisabled ? 0.5 : 1,
                                                animation: isGlowing ? 'chipGlow 1.5s ease-in-out infinite' : 'none',
                                                transition: 'box-shadow 0.3s ease-in-out',
                                                '& .MuiChip-label': {
                                                    color: isDisabled ? 'text.disabled' : 'text.primary',
                                                },
                                                '& .MuiChip-icon': {
                                                    color: isDisabled ? 'text.disabled' : 'primary.main',
                                                },
                                            }}
                                        />
                                    );
                                })}
                            </AttachmentsContainer>
                        </>
                    )}

                    <InputContainer>
                        <IconButton
                            size="small"
                            onClick={handleAttachFile}
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
                            placeholder={isEditMode
                                ? "Describe the changes you want... (e.g., 'Add a table of contents')"
                                : "Type a message... (Enter to send, Shift+Enter for newline)"
                            }
                            value={inputValue}
                            onChange={(e) => setInputValue(e.target.value)}
                            onKeyDown={handleKeyDown}
                            fullWidth
                            disabled={isLoading || isEditLoading || hasDiffTab}
                            sx={{
                                '& .MuiOutlinedInput-root': {
                                    fontSize: '0.875rem',
                                },
                            }}
                        />
                        <Button
                            variant="outlined"
                            size="small"
                            onClick={handleCancelRequest}
                            disabled={!hasActiveRequest}
                            color="warning"
                            sx={{ minWidth: 'auto', px: 2 }}
                        >
                            Cancel
                        </Button>
                        <Button
                            variant="contained"
                            size="small"
                            onClick={handleSendMessage}
                            disabled={!inputValue.trim() || isLoading || isEditLoading || hasDiffTab}
                            color={isEditMode ? 'success' : 'primary'}
                            sx={{ minWidth: 'auto', px: 2 }}
                        >
                            {isEditLoading ? (
                                <CircularProgress size={18} color="inherit" />
                            ) : isEditMode ? (
                                <EditIcon fontSize="small" />
                            ) : (
                                <SendIcon fontSize="small" />
                            )}
                        </Button>
                    </InputContainer>
                </>
            ))}

            <Dialog
                open={clearConfirmOpen}
                onClose={handleClearChatCancel}
            >
                <DialogTitle>Clear Chat?</DialogTitle>
                <DialogContent>
                    <DialogContentText>
                        This will permanently remove all messages in this chat session. Are you sure you want to continue?
                    </DialogContentText>
                </DialogContent>
                <DialogActions>
                    <Button onClick={handleClearChatCancel}>Cancel</Button>
                    <Button onClick={handleClearChatConfirm} variant="contained" color="error">
                        Clear Chat
                    </Button>
                </DialogActions>
            </Dialog>
        </DialogContainer>
    );
}
