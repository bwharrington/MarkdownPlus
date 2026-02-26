import { useState, useEffect, useCallback, useRef } from 'react';
import { useAIProviderCacheContext } from '../contexts/AIProviderCacheContext';
import type { AIModelsConfig } from '../types/global';

export type AIProvider = 'xai' | 'claude' | 'openai' | 'gemini';

export interface AIMessage {
    role: 'user' | 'assistant';
    content: string;
    timestamp: Date;
    attachments?: AttachmentData[];
}

export interface AttachmentData {
    name: string;
    type: 'image' | 'text';
    mimeType?: string;
    data: string;
}

export interface AIModelOption {
    id: string;
    displayName: string;
    provider: AIProvider;
}

export interface AIProviderStatus {
    enabled: boolean;
    status: 'success' | 'error' | 'unchecked';
}

export interface AIProviderStatuses {
    xai: AIProviderStatus;
    claude: AIProviderStatus;
    openai: AIProviderStatus;
    gemini: AIProviderStatus;
}

const ALL_PROVIDERS: AIProvider[] = ['claude', 'openai', 'gemini', 'xai'];

export interface UseAIChatOptions {
    savedModel?: string;
    aiModels?: AIModelsConfig;
}

export function useAIChat(options?: UseAIChatOptions) {
    const {
        providerStatuses,
        isStatusesLoaded,
        fetchModels: cacheFetchModels,
        getCachedModels,
    } = useAIProviderCacheContext();

    const aiModels = options?.aiModels;

    const savedModelRef = useRef(options?.savedModel);
    const currentSelectedModelRef = useRef('');

    // Model state — flat list across all enabled providers
    const [models, setModels] = useState<AIModelOption[]>([]);
    const [selectedModel, setSelectedModel] = useState<string>('');
    const [isLoadingModels, setIsLoadingModels] = useState(false);

    // Chat state
    const [messages, setMessages] = useState<AIMessage[]>([]);
    const [inputValue, setInputValue] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const activeRequestIdRef = useRef<string | null>(null);

    useEffect(() => {
        currentSelectedModelRef.current = selectedModel;
    }, [selectedModel]);

    // Fetch models from all enabled providers when statuses are loaded
    useEffect(() => {
        if (!isStatusesLoaded) return;

        let cancelled = false;

        const pickModelSelection = (allModels: AIModelOption[]) => {
            if (allModels.length === 0) return;
            const saved = savedModelRef.current;
            const current = currentSelectedModelRef.current;
            const match =
                (saved && allModels.find(m => m.id === saved)) ||
                (current && allModels.find(m => m.id === current)) ||
                allModels[0];
            setSelectedModel(match.id);
            savedModelRef.current = undefined;
        };

        const filterByEnabledConfig = (models: AIModelOption[]): AIModelOption[] => {
            if (!aiModels) return models;
            return models.filter(m => {
                const providerConfig = aiModels[m.provider];
                if (!providerConfig) return true;
                const modelConfig = providerConfig[m.id];
                // If config entry exists, respect it; if absent, default to enabled
                return modelConfig === undefined || modelConfig.enabled !== false;
            });
        };

        const loadAllModels = async () => {
            const enabledProviders = ALL_PROVIDERS.filter(p => providerStatuses[p]?.enabled);
            if (enabledProviders.length === 0) return;

            // Try cached models first
            let allCached = true;
            const cachedAll: AIModelOption[] = [];
            for (const p of enabledProviders) {
                const cached = getCachedModels(p);
                if (cached && cached.length > 0) {
                    cachedAll.push(...cached.map(m => ({ ...m, provider: p })));
                } else {
                    allCached = false;
                    break;
                }
            }

            if (allCached && cachedAll.length > 0) {
                const filtered = filterByEnabledConfig(cachedAll);
                setModels(filtered);
                pickModelSelection(filtered);
                return;
            }

            setIsLoadingModels(true);
            setError(null);

            try {
                const results = await Promise.all(
                    enabledProviders.map(async (p) => {
                        try {
                            const fetched = await cacheFetchModels(p);
                            return fetched.map(m => ({ ...m, provider: p }));
                        } catch {
                            return [] as AIModelOption[];
                        }
                    })
                );
                if (cancelled) return;

                const allModels = filterByEnabledConfig(results.flat());
                setModels(allModels);

                if (allModels.length > 0) {
                    pickModelSelection(allModels);
                } else {
                    setError('No models available');
                }
            } catch (err) {
                if (cancelled) return;
                console.error('Failed to fetch models:', err);
                setError('Failed to load models');
            } finally {
                if (!cancelled) {
                    setIsLoadingModels(false);
                }
            }
        };

        loadAllModels();

        return () => { cancelled = true; };
    }, [isStatusesLoaded, providerStatuses, aiModels, cacheFetchModels, getCachedModels]);

    // Derive the provider for the currently selected model
    const getProviderForModel = useCallback((modelId: string): AIProvider | undefined => {
        const model = models.find(m => m.id === modelId);
        return model?.provider;
    }, [models]);

    // Send message
    const sendMessage = useCallback(async (attachedFiles?: Array<{ name: string; path: string; type: string; size: number }>) => {
        if (!inputValue.trim() || isLoading) return;

        const provider = getProviderForModel(selectedModel);
        if (!provider) {
            setError('No model selected');
            return;
        }

        let attachments: AttachmentData[] | undefined;
        if (attachedFiles && attachedFiles.length > 0) {
            try {
                const fileDataPromises = attachedFiles.map(async (file): Promise<AttachmentData | null> => {
                    const fileData = await window.electronAPI.readFileForAttachment(file.path);
                    if (fileData.type === 'image' || fileData.type === 'text') {
                        return {
                            name: file.name,
                            type: fileData.type,
                            mimeType: fileData.mimeType,
                            data: fileData.data!,
                        } as AttachmentData;
                    }
                    return null;
                });

                const results = await Promise.all(fileDataPromises);
                attachments = results.filter((f): f is AttachmentData => f !== null);
            } catch (err) {
                console.error('Failed to read attached files:', err);
                setError('Failed to read attached files');
                return;
            }
        }

        const userMessage: AIMessage = {
            role: 'user',
            content: inputValue.trim(),
            timestamp: new Date(),
            attachments,
        };

        setMessages(prev => [...prev, userMessage]);
        setInputValue('');
        setIsLoading(true);
        setError(null);
        const requestId = `ai-chat-${Date.now()}-${Math.random().toString(36).slice(2)}`;
        activeRequestIdRef.current = requestId;

        try {
            const apiMessages = [...messages, userMessage].map(m => ({
                role: m.role,
                content: m.content,
                attachments: m.attachments,
            }));

            let response;
            if (provider === 'xai') {
                response = await window.electronAPI.aiChatRequest(apiMessages, selectedModel, requestId);
            } else if (provider === 'claude') {
                response = await window.electronAPI.claudeChatRequest(apiMessages, selectedModel, requestId);
            } else if (provider === 'openai') {
                response = await window.electronAPI.openaiChatRequest(apiMessages, selectedModel, requestId);
            } else {
                response = await window.electronAPI.geminiChatRequest(apiMessages, selectedModel, requestId);
            }

            if (activeRequestIdRef.current !== requestId) return;

            if (response.success && response.response) {
                const assistantMessage: AIMessage = {
                    role: 'assistant',
                    content: response.response,
                    timestamp: new Date(),
                };
                setMessages(prev => [...prev, assistantMessage]);
            } else {
                setError(response.error || 'Failed to get response');
            }
        } catch (err) {
            if (activeRequestIdRef.current !== requestId) return;
            console.error('Failed to send message:', err);
            setError('Failed to send message');
        } finally {
            if (activeRequestIdRef.current === requestId) {
                activeRequestIdRef.current = null;
                setIsLoading(false);
            }
        }
    }, [inputValue, isLoading, messages, selectedModel, getProviderForModel]);

    const cancelCurrentRequest = useCallback(async () => {
        const requestId = activeRequestIdRef.current;
        if (!requestId) return;

        activeRequestIdRef.current = null;
        setIsLoading(false);
        setError('Request canceled');

        try {
            await window.electronAPI.cancelAIChatRequest(requestId);
        } catch (err) {
            console.error('Failed to cancel AI request:', err);
        }
    }, []);

    const clearChat = useCallback(() => {
        setMessages([]);
        setError(null);
    }, []);

    return {
        // Provider statuses (for checking enabled state)
        providerStatuses,
        isStatusesLoaded,
        getProviderForModel,

        // Models
        models,
        selectedModel,
        setSelectedModel,
        isLoadingModels,

        // Chat
        messages,
        inputValue,
        setInputValue,
        isLoading,
        error,
        sendMessage,
        cancelCurrentRequest,
        clearChat,
    };
}
