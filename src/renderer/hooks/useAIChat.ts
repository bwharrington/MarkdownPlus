import { useState, useEffect, useCallback, useRef } from 'react';
import { useAIProviderCacheContext } from '../contexts/AIProviderCacheContext';

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

export interface UseAIChatOptions {
    savedProvider?: string;
    savedModel?: string;
}

export function useAIChat(options?: UseAIChatOptions) {
    // Consume provider statuses and model cache from app-level context
    const {
        providerStatuses,
        isStatusesLoaded,
        fetchModels: cacheFetchModels,
        getCachedModels,
    } = useAIProviderCacheContext();

    // Provider state
    const [provider, setProvider] = useState<AIProvider>(
        (options?.savedProvider as AIProvider) || 'claude'
    );
    const savedModelRef = useRef(options?.savedModel);
    const hasAutoSelectedRef = useRef(false);

    // Model state
    const [models, setModels] = useState<AIModelOption[]>([]);
    const [selectedModel, setSelectedModel] = useState<string>('');
    const [isLoadingModels, setIsLoadingModels] = useState(false);

    // Chat state
    const [messages, setMessages] = useState<AIMessage[]>([]);
    const [inputValue, setInputValue] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const activeRequestIdRef = useRef<string | null>(null);

    // Auto-select provider when statuses load or change
    useEffect(() => {
        if (!isStatusesLoaded) return;

        // Auto-select on initial load or when current provider becomes unavailable
        if (!hasAutoSelectedRef.current || !providerStatuses[provider]?.enabled) {
            const saved = options?.savedProvider as AIProvider | undefined;
            if (saved && providerStatuses[saved]?.enabled) {
                setProvider(saved);
            } else if (providerStatuses.claude.enabled) {
                setProvider('claude');
            } else if (providerStatuses.openai.enabled) {
                setProvider('openai');
            } else if (providerStatuses.gemini.enabled) {
                setProvider('gemini');
            } else if (providerStatuses.xai.enabled) {
                setProvider('xai');
            }
            hasAutoSelectedRef.current = true;
        }
    }, [isStatusesLoaded, providerStatuses, provider, options?.savedProvider]);

    // Fetch models when provider changes — cache-aware
    useEffect(() => {
        let cancelled = false;

        const loadModels = async () => {
            // Try cached models first (synchronous)
            const cached = getCachedModels(provider);
            if (cached && cached.length > 0) {
                setModels(cached);
                const saved = savedModelRef.current;
                const match = saved && cached.find(m => m.id === saved);
                setSelectedModel(match ? match.id : cached[0].id);
                savedModelRef.current = undefined;
                return;
            }

            setIsLoadingModels(true);
            setError(null);

            try {
                const fetchedModels = await cacheFetchModels(provider);
                if (cancelled) return;

                setModels(fetchedModels);
                if (fetchedModels.length > 0) {
                    const saved = savedModelRef.current;
                    const match = saved && fetchedModels.find(m => m.id === saved);
                    setSelectedModel(match ? match.id : fetchedModels[0].id);
                    savedModelRef.current = undefined;
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

        loadModels();

        return () => { cancelled = true; };
    }, [provider, cacheFetchModels, getCachedModels]);

    // Send message
    const sendMessage = useCallback(async (attachedFiles?: Array<{ name: string; path: string; type: string; size: number }>) => {
        if (!inputValue.trim() || isLoading) return;

        // Read attached files if any
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
            // Build messages array for API (without timestamps)
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

            // Ignore stale responses for requests that were cancelled or superseded.
            if (activeRequestIdRef.current !== requestId) {
                return;
            }

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
            if (activeRequestIdRef.current !== requestId) {
                return;
            }
            console.error('Failed to send message:', err);
            setError('Failed to send message');
        } finally {
            if (activeRequestIdRef.current === requestId) {
                activeRequestIdRef.current = null;
                setIsLoading(false);
            }
        }
    }, [inputValue, isLoading, messages, provider, selectedModel]);

    const cancelCurrentRequest = useCallback(async () => {
        const requestId = activeRequestIdRef.current;
        if (!requestId) {
            return;
        }

        activeRequestIdRef.current = null;
        setIsLoading(false);
        setError('Request canceled');

        try {
            await window.electronAPI.cancelAIChatRequest(requestId);
        } catch (err) {
            console.error('Failed to cancel AI request:', err);
        }
    }, []);

    // Clear chat
    const clearChat = useCallback(() => {
        setMessages([]);
        setError(null);
    }, []);

    // Get provider options for dropdown
    const getProviderOptions = useCallback(() => {
        const options: Array<{ value: AIProvider; label: string; disabled: boolean; status: string }> = [];

        if (providerStatuses.xai.enabled) {
            options.push({
                value: 'xai',
                label: 'xAI (Grok)',
                disabled: false,
                status: providerStatuses.xai.status,
            });
        }

        if (providerStatuses.claude.enabled) {
            options.push({
                value: 'claude',
                label: 'Anthropic Claude',
                disabled: false,
                status: providerStatuses.claude.status,
            });
        }

        if (providerStatuses.openai.enabled) {
            options.push({
                value: 'openai',
                label: 'OpenAI',
                disabled: false,
                status: providerStatuses.openai.status,
            });
        }

        if (providerStatuses.gemini.enabled) {
            options.push({
                value: 'gemini',
                label: 'Google Gemini',
                disabled: false,
                status: providerStatuses.gemini.status,
            });
        }

        return options;
    }, [providerStatuses]);

    return {
        // Provider
        provider,
        setProvider,
        providerStatuses,
        isStatusesLoaded,
        getProviderOptions,

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
