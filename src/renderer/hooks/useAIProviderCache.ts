import { useState, useEffect, useCallback, useRef } from 'react';
import type { AIProvider, AIProviderStatuses } from './useAIChat';
import type { AIModelOption } from '../types/global';

interface ModelCacheEntry {
    models: AIModelOption[];
}

const DEFAULT_STATUSES: AIProviderStatuses = {
    xai: { enabled: false, status: 'unchecked' },
    claude: { enabled: false, status: 'unchecked' },
    openai: { enabled: false, status: 'unchecked' },
    gemini: { enabled: false, status: 'unchecked' },
};

const PROVIDERS: AIProvider[] = ['xai', 'claude', 'openai', 'gemini'];

function fetchModelsIPC(provider: AIProvider) {
    switch (provider) {
        case 'xai': return window.electronAPI.listAIModels();
        case 'claude': return window.electronAPI.listClaudeModels();
        case 'openai': return window.electronAPI.listOpenAIModels();
        case 'gemini': return window.electronAPI.listGeminiModels();
    }
}

export interface AIProviderCacheValue {
    providerStatuses: AIProviderStatuses;
    isStatusesLoaded: boolean;
    refreshProviderStatuses: () => Promise<AIProviderStatuses>;
    getCachedModels: (provider: AIProvider) => AIModelOption[] | null;
    fetchModels: (provider: AIProvider) => Promise<AIModelOption[]>;
    isLoadingModelsFor: (provider: AIProvider) => boolean;
    invalidateModelsForProvider: (provider: AIProvider) => void;
}

export function useAIProviderCache(): AIProviderCacheValue {
    const [providerStatuses, setProviderStatuses] = useState<AIProviderStatuses>(DEFAULT_STATUSES);
    const [isStatusesLoaded, setIsStatusesLoaded] = useState(false);

    // Model cache stored in ref to avoid re-renders on cache writes
    const modelCacheRef = useRef<Partial<Record<AIProvider, ModelCacheEntry>>>({});

    // Track in-flight model fetches to deduplicate concurrent requests
    const modelFetchPromisesRef = useRef<Partial<Record<AIProvider, Promise<AIModelOption[]>>>>({});

    // Loading state per provider (triggers re-renders for UI)
    const [loadingModels, setLoadingModels] = useState<Partial<Record<AIProvider, boolean>>>({});

    // Fetch provider statuses on app startup
    useEffect(() => {
        const fetchStatuses = async () => {
            try {
                const statuses = await window.electronAPI.getAIProviderStatuses();
                setProviderStatuses(statuses);
            } catch (err) {
                console.error('[AIProviderCache] Failed to fetch provider statuses:', err);
            } finally {
                setIsStatusesLoaded(true);
            }
        };

        fetchStatuses();
    }, []);

    const refreshProviderStatuses = useCallback(async (): Promise<AIProviderStatuses> => {
        try {
            const newStatuses = await window.electronAPI.getAIProviderStatuses();

            // Invalidate model cache for providers whose enabled state changed
            setProviderStatuses(prev => {
                for (const p of PROVIDERS) {
                    if (prev[p].enabled !== newStatuses[p].enabled) {
                        delete modelCacheRef.current[p];
                        delete modelFetchPromisesRef.current[p];
                    }
                }
                return newStatuses;
            });

            setIsStatusesLoaded(true);
            return newStatuses;
        } catch (err) {
            console.error('[AIProviderCache] Failed to refresh provider statuses:', err);
            throw err;
        }
    }, []);

    const getCachedModels = useCallback((provider: AIProvider): AIModelOption[] | null => {
        const entry = modelCacheRef.current[provider];
        return entry ? entry.models : null;
    }, []);

    const fetchModels = useCallback(async (provider: AIProvider): Promise<AIModelOption[]> => {
        // Return cached if available
        const cached = modelCacheRef.current[provider];
        if (cached) {
            return cached.models;
        }

        // Deduplicate: if already fetching, return the existing promise
        const existing = modelFetchPromisesRef.current[provider];
        if (existing) {
            return existing;
        }

        // Start new fetch
        setLoadingModels(prev => ({ ...prev, [provider]: true }));

        const promise = (async () => {
            try {
                const response = await fetchModelsIPC(provider);
                const models = (response.success && response.models) ? response.models : [];
                modelCacheRef.current[provider] = { models };
                return models;
            } finally {
                delete modelFetchPromisesRef.current[provider];
                setLoadingModels(prev => ({ ...prev, [provider]: false }));
            }
        })();

        modelFetchPromisesRef.current[provider] = promise;
        return promise;
    }, []);

    const isLoadingModelsFor = useCallback((provider: AIProvider): boolean => {
        return loadingModels[provider] ?? false;
    }, [loadingModels]);

    const invalidateModelsForProvider = useCallback((provider: AIProvider) => {
        delete modelCacheRef.current[provider];
        delete modelFetchPromisesRef.current[provider];
    }, []);

    return {
        providerStatuses,
        isStatusesLoaded,
        refreshProviderStatuses,
        getCachedModels,
        fetchModels,
        isLoadingModelsFor,
        invalidateModelsForProvider,
    };
}
