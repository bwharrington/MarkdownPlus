import type { AIChatResponse } from '../types/global';
import type { AIProvider } from '../hooks/useAIChat';
import { isMultiAgentModel } from '../../shared/multiAgentUtils';

/**
 * Shared provider routing utility.
 * Routes AI chat requests to the correct IPC handler based on provider.
 * Multi-agent xAI models are routed to the Responses API instead of chat completions.
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
            if (isMultiAgentModel(model)) {
                const result = await window.electronAPI.multiAgentRequest(
                    messages, model, undefined, undefined, undefined, requestId,
                );
                return { success: result.success, response: result.response, error: result.error };
            }
            return window.electronAPI.aiChatRequest(messages, model, requestId, maxTokens);
        case 'claude':
            return window.electronAPI.claudeChatRequest(messages, model, requestId, maxTokens);
        case 'openai':
            return window.electronAPI.openaiChatRequest(messages, model, requestId, maxTokens);
        case 'gemini':
            return window.electronAPI.geminiChatRequest(messages, model, requestId, maxTokens);
    }
}
