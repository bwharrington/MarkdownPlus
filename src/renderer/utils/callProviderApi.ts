import type { AIChatResponse } from '../types/global';
import type { AIProvider } from '../hooks/useAIChat';

/**
 * Shared provider routing utility.
 * Routes AI chat requests to the correct IPC handler based on provider.
 */
export async function callProviderApi(
    provider: AIProvider,
    messages: { role: 'user' | 'assistant'; content: string; attachments?: unknown[] }[],
    model: string,
    requestId: string,
    maxTokens?: number,
): Promise<AIChatResponse> {
    switch (provider) {
        case 'xai':
            return window.electronAPI.aiChatRequest(messages, model, requestId, maxTokens);
        case 'claude':
            return window.electronAPI.claudeChatRequest(messages, model, requestId, maxTokens);
        case 'openai':
            return window.electronAPI.openaiChatRequest(messages, model, requestId, maxTokens);
        case 'gemini':
            return window.electronAPI.geminiChatRequest(messages, model, requestId, maxTokens);
    }
}
