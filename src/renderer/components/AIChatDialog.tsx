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
    CircularProgress,
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
import { useAIResearch } from '../hooks/useAIResearch';
import { useEditLoadingMessage } from '../hooks/useEditLoadingMessage';
import { useEditorState, useEditorDispatch } from '../contexts/EditorContext';
import type { AIChatMode } from '../types/global';
import type { IFile } from '../types';
import { isProviderRestrictedFromMode } from '../aiProviderModeRestrictions';

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
    attachedFiles: AttachedFile[];
    setAttachedFiles: React.Dispatch<React.SetStateAction<AttachedFile[]>>;
    onAddAttachedFiles: (files: AttachedFile[]) => void;
    onRemoveAttachedFile: (filePath: string) => void;
    onToggleFileAttachment: (file: IFile) => void;
    onToggleContextDoc: (filePath: string) => void;
}

export function AIChatDialog({
    open,
    onClose,
    attachedFiles,
    setAttachedFiles,
    onAddAttachedFiles,
    onRemoveAttachedFile,
    onToggleFileAttachment,
    onToggleContextDoc,
}: AIChatDialogProps) {
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

    // Glow animation state for context doc
    const [glowingFile, setGlowingFile] = useState<string | null>(null);

    // Mode state - persisted in config (chat | edit | research)
    const [mode, setMode] = useState<AIChatMode>(editorState.config.aiChatMode ?? 'chat');
    const [editModeError, setEditModeError] = useState<string | null>(null);
    const [isEditLoading, setIsEditLoading] = useState(false);
    const activeEditRequestIdRef = useRef<string | null>(null);
    const [clearConfirmOpen, setClearConfirmOpen] = useState(false);

    // AI Diff Edit hook
    const { requestEdit, hasDiffTab } = useAIDiffEdit();

    // AI Research hook
    const {
        submitResearch,
        cancelResearch,
        dismissResearchProgress,
        isResearchLoading,
        researchError,
        researchPhase,
        deepeningProgress,
        inferenceResult,
        researchComplete,
    } = useAIResearch();

    // Rotating loading messages with typewriter effect
    const { displayText: loadingDisplayText } = useEditLoadingMessage(isEditLoading);

    const {
        provider,
        setProvider,
        isStatusesLoaded,
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

    // Persist mode to config
    const handleModeChange = useCallback((newMode: AIChatMode) => {
        setMode(newMode);
        persistConfig({ aiChatMode: newMode });
        dismissResearchProgress();
    }, [persistConfig, dismissResearchProgress]);

    // Persist provider selection
    const handleProviderChange = useCallback((newProvider: AIProvider) => {
        setProvider(newProvider);
        persistConfig({ aiChatProvider: newProvider });
        dismissResearchProgress();
    }, [setProvider, persistConfig, dismissResearchProgress]);

    // Persist model selection
    const handleModelChange = useCallback((newModel: string) => {
        setSelectedModel(newModel);
        persistConfig({ aiChatModel: newModel });
        dismissResearchProgress();
    }, [setSelectedModel, persistConfig, dismissResearchProgress]);

    // Focus input when dialog opens
    useEffect(() => {
        if (open) {
            requestAnimationFrame(() => {
                inputRef.current?.focus();
            });
        }
    }, [open]);

    // Track the enabled state of the context doc across active-file changes
    const contextDocEnabledRef = useRef(true);

    // Update context doc chip when the active file changes (while open or on open)
    useEffect(() => {
        if (!open) return;

        const activeFile = editorState.activeFileId
            ? editorState.openFiles.find(f => f.id === editorState.activeFileId)
            : null;

        const isValidContextFile = activeFile &&
            activeFile.path &&
            (activeFile.fileType === 'markdown' || activeFile.fileType === 'text');

        setAttachedFiles(prev => {
            const currentContextDoc = prev.find(f => f.isContextDoc);
            const manualFiles = prev.filter(f => !f.isContextDoc);

            if (!isValidContextFile) {
                // No valid active file — demote context doc to regular attached file if present
                if (!currentContextDoc) return prev;
                const demoted: AttachedFile = {
                    name: currentContextDoc.name,
                    path: currentContextDoc.path,
                    type: currentContextDoc.type,
                    size: currentContextDoc.size,
                };
                return [...manualFiles, demoted];
            }

            if (currentContextDoc?.path === activeFile.path) {
                // Same file — no change needed
                return prev;
            }

            // Preserve the enabled state the user set on the previous context doc
            if (currentContextDoc) {
                contextDocEnabledRef.current = currentContextDoc.enabled !== false;
            }

            const newContextDoc: AttachedFile = {
                name: activeFile.name,
                path: activeFile.path!,
                type: activeFile.fileType,
                size: 0,
                isContextDoc: true,
                enabled: contextDocEnabledRef.current,
            };

            // If the new active file was already manually attached, remove that duplicate entry
            const deduplicatedManual = manualFiles.filter(f => f.path !== activeFile.path);

            // Demote old context doc to regular attachment (unless it was the only chip)
            if (currentContextDoc) {
                const demoted: AttachedFile = {
                    name: currentContextDoc.name,
                    path: currentContextDoc.path,
                    type: currentContextDoc.type,
                    size: currentContextDoc.size,
                };
                return [newContextDoc, ...deduplicatedManual, demoted];
            }

            // No previous context doc — just add the new one
            return [newContextDoc, ...deduplicatedManual];
        });
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

    // Reset to chat mode when switching to a provider that doesn't support the current mode
    useEffect(() => {
        if (mode !== 'chat' && isProviderRestrictedFromMode(provider, mode)) {
            handleModeChange('chat');
        }
    }, [provider, mode, handleModeChange]);

    // Open native file picker and add results as attachments
    const handleAttachFromDisk = useCallback(async () => {
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
            onAddAttachedFiles(newFiles);
        }
    }, [onAddAttachedFiles]);

    const handleSendMessage = useCallback(async () => {
        setEditModeError(null);
        dismissResearchProgress();

        // Edit mode request
        if (mode === 'edit' && !isProviderRestrictedFromMode(provider, 'edit')) {
            setIsEditLoading(true);
            const requestId = `ai-edit-${Date.now()}-${Math.random().toString(36).slice(2)}`;
            activeEditRequestIdRef.current = requestId;
            try {
                await requestEdit(inputValue, provider as 'claude' | 'openai', selectedModel, requestId);
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

        // Research mode request
        if (mode === 'research' && !isProviderRestrictedFromMode(provider, 'research')) {
            const requestId = `ai-research-${Date.now()}-${Math.random().toString(36).slice(2)}`;
            try {
                const topic = inputValue;
                setInputValue('');
                await submitResearch(topic, provider, selectedModel, requestId);
            } catch {
                // Error is handled by the useAIResearch hook (researchError state)
            }
            return;
        }

        // Regular chat mode
        const enabledFiles = attachedFiles.filter(file =>
            !file.isContextDoc || file.enabled !== false
        );
        await sendMessage(enabledFiles.length > 0 ? enabledFiles : undefined);
        setAttachedFiles(prev => prev.filter(file => file.isContextDoc));
    }, [mode, provider, selectedModel, inputValue, requestEdit, submitResearch, setInputValue, sendMessage, attachedFiles, dismissResearchProgress]);

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
            return;
        }

        if (isResearchLoading) {
            await cancelResearch();
        }
    }, [isLoading, isEditLoading, isResearchLoading, cancelCurrentRequest, cancelResearch]);

    const handleClearChatConfirm = useCallback(() => {
        clearChat();
        setClearConfirmOpen(false);
    }, [clearChat]);

    if (!open) return null;

    const providerOptions = getProviderOptions();
    const hasProviders = providerOptions.length > 0;
    const hasActiveRequest = isLoading || isEditLoading || isResearchLoading;

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

            {!isCollapsed && (!isStatusesLoaded ? (
                <Box sx={{ p: 3, textAlign: 'center' }}>
                    <CircularProgress size={24} />
                </Box>
            ) : !hasProviders ? (
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
                        mode={mode}
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
                        isResearchLoading={isResearchLoading}
                        researchPhase={researchPhase}
                        deepeningProgress={deepeningProgress}
                        inferenceResult={inferenceResult}
                        researchComplete={researchComplete}
                        hasDiffTab={hasDiffTab}
                        loadingDisplayText={loadingDisplayText}
                        error={error}
                        editModeError={editModeError}
                        researchError={researchError}
                        messagesEndRef={messagesEndRef}
                    />

                    <FileAttachmentsList
                        files={attachedFiles}
                        glowingFile={glowingFile}
                        onRemove={onRemoveAttachedFile}
                        onToggleContextDoc={onToggleContextDoc}
                    />

                    <MessageInput
                        inputRef={inputRef}
                        inputValue={inputValue}
                        mode={mode}
                        isLoading={isLoading}
                        isEditLoading={isEditLoading}
                        isResearchLoading={isResearchLoading}
                        hasDiffTab={hasDiffTab}
                        hasActiveRequest={hasActiveRequest}
                        openFiles={editorState.openFiles}
                        attachedFiles={attachedFiles}
                        onAttachFromDisk={handleAttachFromDisk}
                        onToggleFileAttachment={onToggleFileAttachment}
                        onToggleContextDoc={onToggleContextDoc}
                        onInputChange={setInputValue}
                        onSend={handleSendMessage}
                        onCancel={handleCancelRequest}
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
