import React, { useRef, useEffect, useState } from 'react';
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
    ToggleButton,
    Dialog,
    DialogTitle,
    DialogContent,
    DialogContentText,
    DialogActions,
} from '@mui/material';
import {
    CloseIcon,
    DragIndicatorIcon,
    SendIcon,
    DeleteOutlineIcon,
    ExpandLessIcon,
    ExpandMoreIcon,
    AttachFileIcon,
    EditIcon,
    WarningAmberIcon,
    VisibilityIcon,
    VisibilityOffIcon,
    DockRightIcon,
    UndockIcon,
} from './AppIcons';
import ReactMarkdown from 'react-markdown';
import { useAIChat, AIProvider } from '../hooks';
import { useAIDiffEdit } from '../hooks/useAIDiffEdit';
import { useEditLoadingMessage } from '../hooks/useEditLoadingMessage';
import { useEditorState } from '../contexts/EditorContext';

const DialogContainer = styled(Box)(({ theme }) => ({
    position: 'absolute',
    zIndex: 1000,
    backgroundColor: theme.palette.background.paper,
    border: `1px solid ${theme.palette.divider}`,
    borderRadius: 4,
    boxShadow: theme.shadows[4],
    overflow: 'hidden',
    display: 'flex',
    flexDirection: 'column',
    minWidth: 350,
    minHeight: 42,
}));

const DragHandle = styled(Box)(({ theme }) => ({
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '8px 12px',
    cursor: 'move',
    backgroundColor: theme.palette.action.hover,
    borderBottom: `1px solid ${theme.palette.divider}`,
    '&:hover': {
        backgroundColor: theme.palette.action.selected,
    },
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

const ResizeHandle = styled(Box)(({ theme }) => ({
    position: 'absolute',
    bottom: 0,
    left: 0,
    width: 16,
    height: 16,
    cursor: 'nesw-resize',
    '&::after': {
        content: '""',
        position: 'absolute',
        bottom: 2,
        left: 2,
        width: 10,
        height: 10,
        backgroundColor: theme.palette.divider,
        clipPath: 'polygon(0 100%, 0 0, 100% 100%)',
    },
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
    isDocked?: boolean;
    onDockChange?: (isDocked: boolean) => void;
}

interface AttachedFile {
    name: string;
    path: string;
    type: string;
    size: number;
    isContextDoc?: boolean; // True if this is the current document
    enabled?: boolean; // True if context doc is enabled (default true)
}

export function AIChatDialog({ open, onClose, isDocked = false, onDockChange }: AIChatDialogProps) {
    const dialogRef = useRef<HTMLDivElement>(null);
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLTextAreaElement>(null);
    const editorState = useEditorState();

    const [position, setPosition] = useState({ x: 0, y: 50 });
    const [isDragging, setIsDragging] = useState(false);
    const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
    const [isDialogFocused, setIsDialogFocused] = useState(true);

    // Collapse/Expand state
    const [isCollapsed, setIsCollapsed] = useState(false);

    // Resize state
    const [size, setSize] = useState({ width: 450, height: 550 });
    const [isResizing, setIsResizing] = useState(false);
    const [resizeStart, setResizeStart] = useState({ x: 0, y: 0, width: 0, height: 0, left: 0, rightEdge: 0 });

    // File attachments state
    const [attachedFiles, setAttachedFiles] = useState<AttachedFile[]>([]);
    const [glowingFile, setGlowingFile] = useState<string | null>(null);

    // Edit mode state
    const [isEditMode, setIsEditMode] = useState(false);
    const [editModeError, setEditModeError] = useState<string | null>(null);
    const [isEditLoading, setIsEditLoading] = useState(false);
    const activeEditRequestIdRef = useRef<string | null>(null);
    const [clearConfirmOpen, setClearConfirmOpen] = useState(false);

    // AI Diff Edit hook
    const { requestEdit, diffSession } = useAIDiffEdit();

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
    } = useAIChat();

    // Initialize position when dialog opens
    useEffect(() => {
        if (open && !isDocked && dialogRef.current) {
            const rect = dialogRef.current.getBoundingClientRect();
            const parentRect = dialogRef.current.parentElement?.getBoundingClientRect();
            if (parentRect) {
                // Position on the right side by default
                setPosition({
                    x: parentRect.width - rect.width - 16,
                    y: 50
                });
            }
        }
    }, [open, isDocked]);

    // Focus input when dialog opens
    useEffect(() => {
        if (open) {
            requestAnimationFrame(() => {
                inputRef.current?.focus();
                setIsDialogFocused(true);
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
            setIsEditMode(false);
        }
    }, [provider, isEditMode]);

    // Handle focus/blur events to change opacity
    useEffect(() => {
        if (isDocked) {
            setIsDialogFocused(true);
            return;
        }

        const handleFocusIn = (e: FocusEvent) => {
            if (dialogRef.current && dialogRef.current.contains(e.target as Node)) {
                setIsDialogFocused(true);
            }
        };

        const handleFocusOut = (e: FocusEvent) => {
            if (dialogRef.current && !dialogRef.current.contains(e.relatedTarget as Node)) {
                setIsDialogFocused(false);
            }
        };

        const handleMouseDown = (e: MouseEvent) => {
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
    }, [open, isDocked]);

    // Handle dragging
    const handleDragMouseDown = (e: React.MouseEvent) => {
        if (isDocked) {
            return;
        }

        if (dialogRef.current) {
            setIsDragging(true);
            setDragStart({
                x: e.clientX - position.x,
                y: e.clientY - position.y
            });
            e.preventDefault();
        }
    };

    useEffect(() => {
        const handleMouseMove = (e: MouseEvent) => {
            if (isDragging && dialogRef.current) {
                const parentRect = dialogRef.current.parentElement?.getBoundingClientRect();
                if (parentRect) {
                    let newX = e.clientX - dragStart.x;
                    let newY = e.clientY - dragStart.y;

                    // Constrain to parent bounds
                    const dialogRect = dialogRef.current.getBoundingClientRect();
                    newX = Math.max(0, Math.min(newX, parentRect.width - dialogRect.width));
                    newY = Math.max(0, Math.min(newY, parentRect.height - dialogRect.height));

                    setPosition({ x: newX, y: newY });
                }
            }
        };

        const handleMouseUp = () => {
            setIsDragging(false);
        };

        if (isDragging) {
            document.addEventListener('mousemove', handleMouseMove);
            document.addEventListener('mouseup', handleMouseUp);
            return () => {
                document.removeEventListener('mousemove', handleMouseMove);
                document.removeEventListener('mouseup', handleMouseUp);
            };
        }
    }, [isDragging, dragStart]);

    // Handle resizing
    const handleResizeMouseDown = (e: React.MouseEvent) => {
        if (isDocked) {
            return;
        }

        e.preventDefault();
        e.stopPropagation();
        setIsResizing(true);
        setResizeStart({
            x: e.clientX,
            y: e.clientY,
            width: size.width,
            height: size.height,
            left: position.x,
            rightEdge: position.x + size.width,
        });
    };

    useEffect(() => {
        const handleMouseMove = (e: MouseEvent) => {
            if (isResizing) {
                const deltaX = e.clientX - resizeStart.x;
                const deltaY = e.clientY - resizeStart.y;
                const newHeight = Math.max(200, resizeStart.height + deltaY);
                const minWidth = 350;

                // Bottom-left handle: move left edge while keeping right edge anchored.
                const proposedLeft = resizeStart.left + deltaX;
                const maxLeft = resizeStart.rightEdge - minWidth;
                const newLeft = Math.max(0, Math.min(proposedLeft, maxLeft));
                const newWidth = resizeStart.rightEdge - newLeft;

                setPosition(prev => ({ ...prev, x: newLeft }));
                setSize({ width: newWidth, height: newHeight });
            }
        };

        const handleMouseUp = () => {
            setIsResizing(false);
        };

        if (isResizing) {
            document.addEventListener('mousemove', handleMouseMove);
            document.addEventListener('mouseup', handleMouseUp);
            return () => {
                document.removeEventListener('mousemove', handleMouseMove);
                document.removeEventListener('mouseup', handleMouseUp);
            };
        }
    }, [isResizing, resizeStart]);

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
        <DialogContainer
            ref={dialogRef}
            sx={{
                position: isDocked ? 'relative' : 'absolute',
                left: isDocked ? 'auto' : position.x,
                top: isDocked ? 'auto' : position.y,
                width: isDocked ? '100%' : (isCollapsed ? 'auto' : size.width),
                height: isDocked ? '100%' : (isCollapsed ? 'auto' : size.height),
                minWidth: isDocked ? 0 : 350,
                borderRadius: isDocked ? 0 : 4,
                boxShadow: isDocked ? 'none' : 4,
                borderTop: isDocked ? 'none' : undefined,
                borderBottom: isDocked ? 'none' : undefined,
                borderRight: isDocked ? 'none' : undefined,
                cursor: isDragging ? 'grabbing' : (isResizing ? 'nwse-resize' : 'default'),
                opacity: isDocked ? 1 : (isDialogFocused ? 1 : 0.6),
                transition: isDocked ? 'none' : 'opacity 0.2s ease-in-out',
            }}
        >
            <DragHandle
                onMouseDown={isDocked ? undefined : handleDragMouseDown}
                sx={{ cursor: isDocked ? 'default' : 'move' }}
            >
                <HeaderControls>
                    {!isDocked && <DragIndicatorIcon fontSize="small" sx={{ color: 'text.secondary' }} />}
                    <Typography variant="subtitle2" fontWeight={600}>
                        AI Chat
                    </Typography>
                </HeaderControls>
                <HeaderControls>
                    <IconButton
                        size="small"
                        onClick={() => onDockChange?.(!isDocked)}
                        title={isDocked ? 'Float' : 'Dock right'}
                    >
                        {isDocked ? <UndockIcon fontSize="small" /> : <DockRightIcon fontSize="small" />}
                    </IconButton>
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
            </DragHandle>

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
                                onChange={(e) => setProvider(e.target.value as AIProvider)}
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
                                onChange={(e) => setSelectedModel(e.target.value)}
                                disabled={isLoadingModels || hasActiveRequest}
                            >
                                {models.map((model) => (
                                    <MenuItem key={model.id} value={model.id}>
                                        {model.displayName}
                                    </MenuItem>
                                ))}
                            </Select>
                        </FormControl>

                        {/* Edit mode toggle or xAI warning */}
                        {provider === 'xai' ? (
                            <Tooltip title="xAI does not support structured output required for edit mode. Switch to Claude or OpenAI to use edit mode.">
                                <Chip
                                    icon={<WarningAmberIcon fontSize="small" />}
                                    label="Edit N/A"
                                    size="small"
                                    color="warning"
                                    variant="outlined"
                                    sx={{
                                        fontSize: '0.7rem',
                                        height: 32,
                                        alignSelf: 'center',
                                    }}
                                />
                            </Tooltip>
                        ) : (
                            <Tooltip title={isEditMode ? "Edit mode: AI will modify your document" : "Chat mode: Have a conversation with AI"}>
                                <ToggleButton
                                    value="edit"
                                    selected={isEditMode}
                                    onChange={() => setIsEditMode(!isEditMode)}
                                    size="small"
                                    disabled={diffSession?.isActive}
                                    sx={{
                                        height: 32,
                                        minWidth: 32,
                                        alignSelf: 'center',
                                        borderColor: isEditMode ? 'primary.main' : 'divider',
                                        backgroundColor: isEditMode ? 'primary.main' : 'transparent',
                                        color: isEditMode ? 'primary.contrastText' : 'text.secondary',
                                        '&:hover': {
                                            backgroundColor: isEditMode ? 'primary.dark' : 'action.hover',
                                        },
                                        '&.Mui-selected': {
                                            backgroundColor: 'primary.main',
                                            color: 'primary.contrastText',
                                            '&:hover': {
                                                backgroundColor: 'primary.dark',
                                            },
                                        },
                                    }}
                                >
                                    <EditIcon fontSize="small" />
                                </ToggleButton>
                            </Tooltip>
                        )}
                    </SelectorsContainer>

                    <MessagesContainer>
                        {messages.length === 0 ? (
                            <Box sx={{ textAlign: 'center', py: 4 }}>
                                <Typography color="text.secondary" variant="body2">
                                    Start a conversation with AI
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
                        {diffSession?.isActive && (
                            <Box sx={{
                                textAlign: 'center',
                                py: 1,
                                px: 2,
                                backgroundColor: 'success.main',
                                color: 'success.contrastText',
                                borderRadius: 1,
                            }}>
                                <Typography variant="body2">
                                    Edit in progress - {diffSession.hunks.filter(h => h.status === 'pending').length} changes pending
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
                            disabled={isLoading || isEditLoading || diffSession?.isActive}
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
                            disabled={!inputValue.trim() || isLoading || isEditLoading || diffSession?.isActive}
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

            {!isCollapsed && !isDocked && <ResizeHandle onMouseDown={handleResizeMouseDown} />}
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
