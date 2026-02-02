import { useState, useEffect, useCallback } from 'react';

export type AIProvider = 'xai' | 'claude' | 'openai';

export interface AIMessage {
    role: 'user' | 'assistant';
    content: string;
    timestamp: Date;
}

export interface AIModelOption {
    id: string;
    displayName: string;
}

export interface AIProviderStatus {
    enabled: boolean;
    status: 'success' | 'error' | 'unchecked' | 'checking';
}

export interface AIProviderStatuses {
    xai: AIProviderStatus;
    claude: AIProviderStatus;
    openai: AIProviderStatus;
}

export function useAIChat() {
    // Provider state
    const [provider, setProvider] = useState<AIProvider>('xai');
    const [providerStatuses, setProviderStatuses] = useState<AIProviderStatuses>({
        xai: { enabled: false, status: 'unchecked' },
        claude: { enabled: false, status: 'unchecked' },
        openai: { enabled: false, status: 'unchecked' },
    });

    // Model state
    const [models, setModels] = useState<AIModelOption[]>([]);
    const [selectedModel, setSelectedModel] = useState<string>('');
    const [isLoadingModels, setIsLoadingModels] = useState(false);

    // Chat state
    const [messages, setMessages] = useState<AIMessage[]>([]);
    const [inputValue, setInputValue] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Fetch provider statuses on mount
    useEffect(() => {
        const checkProviderStatuses = async () => {
            setProviderStatuses({
                xai: { enabled: false, status: 'checking' },
                claude: { enabled: false, status: 'checking' },
                openai: { enabled: false, status: 'checking' },
            });

            try {
                const statuses = await window.electronAPI.getAIProviderStatuses();
                setProviderStatuses(statuses);

                // Set initial provider to first enabled one
                if (statuses.xai.enabled) {
                    setProvider('xai');
                } else if (statuses.claude.enabled) {
                    setProvider('claude');
                } else if (statuses.openai.enabled) {
                    setProvider('openai');
                }
            } catch (err) {
                console.error('Failed to check provider statuses:', err);
            }
        };

        checkProviderStatuses();
    }, []);

    // Fetch models when provider changes
    useEffect(() => {
        const fetchModels = async () => {
            setIsLoadingModels(true);
            setError(null);

            try {
                const response = provider === 'xai'
                    ? await window.electronAPI.listAIModels()
                    : provider === 'claude'
                        ? await window.electronAPI.listClaudeModels()
                        : await window.electronAPI.listOpenAIModels();

                if (response.success && response.models) {
                    setModels(response.models);
                    if (response.models.length > 0) {
                        setSelectedModel(response.models[0].id);
                    }
                } else {
                    setError(response.error || 'Failed to load models');
                }
            } catch (err) {
                console.error('Failed to fetch models:', err);
                setError('Failed to load models');
            } finally {
                setIsLoadingModels(false);
            }
        };

        fetchModels();
    }, [provider]);

    // Send message
    const sendMessage = useCallback(async () => {
        if (!inputValue.trim() || isLoading) return;

        const userMessage: AIMessage = {
            role: 'user',
            content: inputValue.trim(),
            timestamp: new Date(),
        };

        setMessages(prev => [...prev, userMessage]);
        setInputValue('');
        setIsLoading(true);
        setError(null);

        try {
            // Build messages array for API (without timestamps)
            const apiMessages = [...messages, userMessage].map(m => ({
                role: m.role,
                content: m.content,
            }));

            const response = provider === 'xai'
                ? await window.electronAPI.aiChatRequest(apiMessages, selectedModel)
                : provider === 'claude'
                    ? await window.electronAPI.claudeChatRequest(apiMessages, selectedModel)
                    : await window.electronAPI.openaiChatRequest(apiMessages, selectedModel);

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
            console.error('Failed to send message:', err);
            setError('Failed to send message');
        } finally {
            setIsLoading(false);
        }
    }, [inputValue, isLoading, messages, provider, selectedModel]);

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

        return options;
    }, [providerStatuses]);

    return {
        // Provider
        provider,
        setProvider,
        providerStatuses,
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
        clearChat,
    };
}
