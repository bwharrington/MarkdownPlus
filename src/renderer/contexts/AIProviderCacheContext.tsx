import React, { createContext, useContext } from 'react';
import { useAIProviderCache } from '../hooks/useAIProviderCache';
import type { AIProviderCacheValue } from '../hooks/useAIProviderCache';

const AIProviderCacheContext = createContext<AIProviderCacheValue | null>(null);

export function AIProviderCacheProvider({ children }: { children: React.ReactNode }) {
    const cache = useAIProviderCache();

    return (
        <AIProviderCacheContext.Provider value={cache}>
            {children}
        </AIProviderCacheContext.Provider>
    );
}

export function useAIProviderCacheContext(): AIProviderCacheValue {
    const context = useContext(AIProviderCacheContext);
    if (!context) {
        throw new Error('useAIProviderCacheContext must be used within AIProviderCacheProvider');
    }
    return context;
}
