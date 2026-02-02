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
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import DragIndicatorIcon from '@mui/icons-material/DragIndicator';
import SendIcon from '@mui/icons-material/Send';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import ExpandLessIcon from '@mui/icons-material/ExpandLess';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ReactMarkdown from 'react-markdown';
import { useAIChat, AIProvider } from '../hooks';

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
    right: 0,
    width: 16,
    height: 16,
    cursor: 'nwse-resize',
    '&::after': {
        content: '""',
        position: 'absolute',
        bottom: 2,
        right: 2,
        width: 0,
        height: 0,
        borderStyle: 'solid',
        borderWidth: '0 0 10px 10px',
        borderColor: `transparent transparent ${theme.palette.divider} transparent`,
    },
}));

interface AIChatDialogProps {
    open: boolean;
    onClose: () => void;
}

export function AIChatDialog({ open, onClose }: AIChatDialogProps) {
    const dialogRef = useRef<HTMLDivElement>(null);
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLTextAreaElement>(null);

    const [position, setPosition] = useState({ x: 0, y: 50 });
    const [isDragging, setIsDragging] = useState(false);
    const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
    const [isDialogFocused, setIsDialogFocused] = useState(true);

    // Collapse/Expand state
    const [isCollapsed, setIsCollapsed] = useState(false);

    // Resize state
    const [size, setSize] = useState({ width: 450, height: 550 });
    const [isResizing, setIsResizing] = useState(false);
    const [resizeStart, setResizeStart] = useState({ x: 0, y: 0, width: 0, height: 0 });

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
        clearChat,
    } = useAIChat();

    // Initialize position when dialog opens
    useEffect(() => {
        if (open && dialogRef.current) {
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
    }, [open]);

    // Focus input when dialog opens
    useEffect(() => {
        if (open) {
            requestAnimationFrame(() => {
                inputRef.current?.focus();
                setIsDialogFocused(true);
            });
        }
    }, [open]);

    // Scroll to bottom when new messages arrive
    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);

    // Handle focus/blur events to change opacity
    useEffect(() => {
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
    }, [open]);

    // Handle dragging
    const handleDragMouseDown = (e: React.MouseEvent) => {
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
        e.preventDefault();
        e.stopPropagation();
        setIsResizing(true);
        setResizeStart({
            x: e.clientX,
            y: e.clientY,
            width: size.width,
            height: size.height,
        });
    };

    useEffect(() => {
        const handleMouseMove = (e: MouseEvent) => {
            if (isResizing) {
                const deltaX = e.clientX - resizeStart.x;
                const deltaY = e.clientY - resizeStart.y;

                const newWidth = Math.max(350, resizeStart.width + deltaX);
                const newHeight = Math.max(200, resizeStart.height + deltaY);

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

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            sendMessage();
        } else if (e.key === 'Escape') {
            onClose();
        }
    };

    return (
        <DialogContainer
            ref={dialogRef}
            sx={{
                left: position.x,
                top: position.y,
                width: isCollapsed ? 'auto' : size.width,
                height: isCollapsed ? 'auto' : size.height,
                cursor: isDragging ? 'grabbing' : (isResizing ? 'nwse-resize' : 'default'),
                opacity: isDialogFocused ? 1 : 0.6,
                transition: 'opacity 0.2s ease-in-out',
            }}
        >
            <DragHandle onMouseDown={handleDragMouseDown}>
                <HeaderControls>
                    <DragIndicatorIcon fontSize="small" sx={{ color: 'text.secondary' }} />
                    <Typography variant="subtitle2" fontWeight={600}>
                        AI Chat
                    </Typography>
                </HeaderControls>
                <HeaderControls>
                    <IconButton size="small" onClick={() => setIsCollapsed(!isCollapsed)} title={isCollapsed ? "Expand" : "Collapse"}>
                        {isCollapsed ? <ExpandMoreIcon fontSize="small" /> : <ExpandLessIcon fontSize="small" />}
                    </IconButton>
                    <IconButton size="small" onClick={clearChat} title="Clear chat">
                        <DeleteOutlineIcon fontSize="small" />
                    </IconButton>
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
                        Add API keys to .env file:
                    </Typography>
                    <Typography variant="body2" component="pre" sx={{ mt: 1, textAlign: 'left', bgcolor: 'action.hover', p: 1, borderRadius: 1 }}>
                        XAI_API_KEY=your_key{'\n'}
                        ANTHROPIC_API_KEY=your_key
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
                                disabled={isLoadingModels}
                            >
                                {models.map((model) => (
                                    <MenuItem key={model.id} value={model.id}>
                                        {model.displayName}
                                    </MenuItem>
                                ))}
                            </Select>
                        </FormControl>
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
                        {error && (
                            <Typography color="error" variant="body2" sx={{ textAlign: 'center' }}>
                                {error}
                            </Typography>
                        )}
                        <div ref={messagesEndRef} />
                    </MessagesContainer>

                    <InputContainer>
                        <TextField
                            inputRef={inputRef}
                            multiline
                            maxRows={4}
                            size="small"
                            placeholder="Type a message... (Enter to send, Shift+Enter for newline)"
                            value={inputValue}
                            onChange={(e) => setInputValue(e.target.value)}
                            onKeyDown={handleKeyDown}
                            fullWidth
                            disabled={isLoading}
                            sx={{
                                '& .MuiOutlinedInput-root': {
                                    fontSize: '0.875rem',
                                },
                            }}
                        />
                        <Button
                            variant="contained"
                            size="small"
                            onClick={sendMessage}
                            disabled={!inputValue.trim() || isLoading}
                            sx={{ minWidth: 'auto', px: 2 }}
                        >
                            <SendIcon fontSize="small" />
                        </Button>
                    </InputContainer>
                </>
            ))}

            {!isCollapsed && <ResizeHandle onMouseDown={handleResizeMouseDown} />}
        </DialogContainer>
    );
}
