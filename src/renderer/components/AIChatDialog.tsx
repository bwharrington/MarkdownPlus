import React, { useRef, useEffect, useState, useCallback } from 'react';
import {
    Box,
    styled,
    IconButton,
    Typography,
    Button,
    Dialog,
    DialogTitle,
    DialogContent,
    DialogContentText,
    DialogActions,
} from '@mui/material';
import {
    CloseIcon,
    DeleteOutlineIcon,
    ExpandLessIcon,
    ExpandMoreIcon,
} from './AppIcons';
import { ChatMessages } from './ChatMessages';
import { ProviderSelector } from './ProviderSelector';
import { FileAttachmentsList } from './FileAttachmentsList';
import type { AttachedFile } from './FileAttachmentsList';
import { MessageInput } from './MessageInput';
import { useAIChat, AIProvider } from '../hooks';
import { useAIDiffEdit } from '../hooks/useAIDiffEdit';
import { useEditLoadingMessage } from '../hooks/useEditLoadingMessage';
import { useEditorState, useEditorDispatch } from '../contexts/EditorContext';

const AI_GREETINGS = [
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

const NoProvidersContainer = styled(Box)({
    padding: 24,
    textAlign: 'center',
});

interface AIChatDialogProps {
    open: boolean;
    onClose: () => void;
}

export function AIChatDialog({ open, onClose }: AIChatDialogProps) {
    const dialogRef = useRef<HTMLDivElement>(null);
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLTextAreaElement>(null);
    const editorState = useEditorState();
    const dispatch = useEditorDispatch();

    // Random greeting (stable for session lifetime)
    const [greeting] = useState(() =>
        AI_GREETINGS[Math.floor(Math.random() * AI_GREETINGS.length)]
    );

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
        void window.electronAPI.saveConfig(nextConfig).catch((err: unknown) => {
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

            if (activeFile && contextDoc && activeFile.path === contextDoc.path && !activeFile.isDirty) {
                setGlowingFile(contextDoc.path);

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

    // File attachment handlers
    const handleAttachFile = useCallback(async () => {
        const result = await window.electronAPI.openFileDialog({
            properties: ['openFile', 'multiSelections'],
        });

        if (result && !result.canceled && result.filePaths.length > 0) {
            const newFiles: AttachedFile[] = result.filePaths.map((filePath: string) => {
                const parts = filePath.split(/[/\\]/);
                const fileName = parts[parts.length - 1] || filePath;
                const fileExtension = fileName.includes('.')
                    ? fileName.split('.').pop()?.toLowerCase() || 'unknown'
                    : 'unknown';
                return {
                    name: fileName,
                    path: filePath,
                    type: fileExtension,
                    size: 0,
                };
            });
            setAttachedFiles(prev => [...prev, ...newFiles]);
        }
    }, []);

    const handleRemoveFile = useCallback((filePath: string) => {
        setAttachedFiles(prev => prev.filter(file => file.path !== filePath));
    }, []);

    const handleToggleContextDoc = useCallback((filePath: string) => {
        setAttachedFiles(prev => prev.map(file =>
            file.path === filePath && file.isContextDoc
                ? { ...file, enabled: !file.enabled }
                : file
        ));
    }, []);

    const handleSendMessage = useCallback(async () => {
        setEditModeError(null);

        // Edit mode request
        if (isEditMode && (provider === 'claude' || provider === 'openai')) {
            setIsEditLoading(true);
            const requestId = `ai-edit-${Date.now()}-${Math.random().toString(36).slice(2)}`;
            activeEditRequestIdRef.current = requestId;
            try {
                await requestEdit(inputValue, provider, selectedModel, requestId);
                if (activeEditRequestIdRef.current !== requestId) return;
                setInputValue('');
            } catch (err) {
                if (activeEditRequestIdRef.current !== requestId) return;
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
        setAttachedFiles(prev => prev.filter(file => file.isContextDoc));
    }, [isEditMode, provider, selectedModel, inputValue, requestEdit, setInputValue, sendMessage, attachedFiles]);

    const handleCancelRequest = useCallback(async () => {
        if (isLoading) {
            await cancelCurrentRequest();
            return;
        }

        if (isEditLoading) {
            const requestId = activeEditRequestIdRef.current;
            activeEditRequestIdRef.current = null;
            setIsEditLoading(false);
            setEditModeError('Edit request canceled');

            if (!requestId) return;

            try {
                await window.electronAPI.cancelAIEditRequest(requestId);
            } catch (err) {
                console.error('Failed to cancel AI edit request:', err);
            }
        }
    }, [isLoading, isEditLoading, cancelCurrentRequest]);

    const handleClearChatConfirm = useCallback(() => {
        clearChat();
        setClearConfirmOpen(false);
    }, [clearChat]);

    if (!open) return null;

    const providerOptions = getProviderOptions();
    const hasProviders = providerOptions.length > 0;
    const hasActiveRequest = isLoading || isEditLoading;

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
                        <IconButton size="small" onClick={() => setClearConfirmOpen(true)} title="Clear chat">
                            <DeleteOutlineIcon fontSize="small" />
                        </IconButton>
                    )}
                    <IconButton size="small" onClick={onClose}>
                        <CloseIcon fontSize="small" />
                    </IconButton>
                </HeaderControls>
            </PanelHeader>

            {!isCollapsed && (!hasProviders ? (
                <NoProvidersContainer>
                    <Typography color="text.secondary" gutterBottom>
                        No AI providers configured
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                        Add API keys in Settings (Ctrl+,) under the "AI API Keys" section.
                    </Typography>
                </NoProvidersContainer>
            ) : (
                <>
                    <ProviderSelector
                        provider={provider}
                        providerOptions={providerOptions}
                        models={models}
                        selectedModel={selectedModel}
                        isLoadingModels={isLoadingModels}
                        isEditMode={isEditMode}
                        hasDiffTab={hasDiffTab}
                        hasActiveRequest={hasActiveRequest}
                        onProviderChange={handleProviderChange}
                        onModelChange={handleModelChange}
                        onModeChange={handleModeChange}
                    />

                    <ChatMessages
                        messages={messages}
                        greeting={greeting}
                        isLoading={isLoading}
                        isEditLoading={isEditLoading}
                        hasDiffTab={hasDiffTab}
                        loadingDisplayText={loadingDisplayText}
                        error={error}
                        editModeError={editModeError}
                        messagesEndRef={messagesEndRef}
                    />

                    <FileAttachmentsList
                        files={attachedFiles}
                        glowingFile={glowingFile}
                        onRemove={handleRemoveFile}
                        onToggleContextDoc={handleToggleContextDoc}
                    />

                    <MessageInput
                        inputRef={inputRef}
                        inputValue={inputValue}
                        isEditMode={isEditMode}
                        isLoading={isLoading}
                        isEditLoading={isEditLoading}
                        hasDiffTab={hasDiffTab}
                        hasActiveRequest={hasActiveRequest}
                        onInputChange={setInputValue}
                        onSend={handleSendMessage}
                        onCancel={handleCancelRequest}
                        onAttachFile={handleAttachFile}
                        onClose={onClose}
                    />
                </>
            ))}

            <Dialog
                open={clearConfirmOpen}
                onClose={() => setClearConfirmOpen(false)}
            >
                <DialogTitle>Clear Chat?</DialogTitle>
                <DialogContent>
                    <DialogContentText>
                        This will permanently remove all messages in this chat session. Are you sure you want to continue?
                    </DialogContentText>
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setClearConfirmOpen(false)}>Cancel</Button>
                    <Button onClick={handleClearChatConfirm} variant="contained" color="error">
                        Clear Chat
                    </Button>
                </DialogActions>
            </Dialog>
        </DialogContainer>
    );
}
