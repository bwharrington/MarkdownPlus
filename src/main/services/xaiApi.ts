import { log, logError } from '../logger';
import { getApiKeyForService } from '../secureStorageIpcHandlers';

export interface AttachmentData {
    name: string;
    type: 'image' | 'text';
    mimeType?: string;
    data: string;
}

export interface Message {
    role: 'user' | 'assistant';
    content: string;
    attachments?: AttachmentData[];
}

export interface XAiApiResponse {
    choices: Array<{
        message: {
            content: string;
        };
    }>;
}

export interface Model {
    id: string;
    object: string;
    created?: number;
    owned_by?: string;
}

export interface ListModelsResponse {
    object: string;
    data: Model[];
}

// Default models to use if API listing fails
export const DEFAULT_XAI_MODELS = [
    { id: 'grok-3-fast', displayName: 'Grok 3 Fast' },
    { id: 'grok-3', displayName: 'Grok 3' },
    { id: 'grok-3-mini', displayName: 'Grok 3 Mini' },
];

export async function callXAiApi(messages: Message[], model: string = 'grok-3-fast'): Promise<string> {
    // Only use secure storage (no .env fallback)
    const apiKey = getApiKeyForService('xai');
    if (!apiKey) {
        throw new Error('XAI_API_KEY not found. Please set it in Settings');
    }

    // Format messages for xAI API (support attachments, similar to OpenAI format)
    const formattedMessages = messages.map(msg => {
        // If message has attachments, use content array format
        if (msg.attachments && msg.attachments.length > 0) {
            const content: any[] = [{ type: 'text', text: msg.content }];

            // Add attachments
            for (const attachment of msg.attachments) {
                if (attachment.type === 'image') {
                    content.push({
                        type: 'image_url',
                        image_url: {
                            url: `data:${attachment.mimeType};base64,${attachment.data}`,
                        },
                    });
                } else if (attachment.type === 'text') {
                    // Include text files as additional text content
                    content.push({
                        type: 'text',
                        text: `\n\n[File: ${attachment.name}]\n${attachment.data}`,
                    });
                }
            }

            return { role: msg.role, content };
        }

        // Simple text message
        return { role: msg.role, content: msg.content };
    });

    log('xAI API Request', {
        url: 'https://api.x.ai/v1/chat/completions',
        model,
        messageCount: messages.length,
    });

    try {
        const response = await fetch('https://api.x.ai/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${apiKey}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                messages: formattedMessages,
                model,
            }),
        });

        log('xAI API Response Status', { status: response.status, statusText: response.statusText });

        const data: XAiApiResponse = await response.json();

        if (!response.ok) {
            throw new Error(`API request failed with status ${response.status}: ${response.statusText}`);
        }

        return data.choices[0]?.message?.content || 'No response from AI';
    } catch (error) {
        logError('Error calling xAI API', error as Error);
        throw new Error(`Failed to call xAI API: ${error instanceof Error ? error.message : String(error)}`);
    }
}

export async function listModels(): Promise<Model[]> {
    // Only use secure storage (no .env fallback)
    const apiKey = getApiKeyForService('xai');
    if (!apiKey) {
        throw new Error('XAI_API_KEY not found. Please set it in Settings');
    }

    log('xAI List Models Request', { url: 'https://api.x.ai/v1/models' });

    try {
        const response = await fetch('https://api.x.ai/v1/models', {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${apiKey}`,
            },
        });

        log('xAI List Models Response Status', { status: response.status, statusText: response.statusText });

        const data: ListModelsResponse = await response.json();

        if (!response.ok) {
            throw new Error(`Failed to list models: ${response.status} ${response.statusText}`);
        }

        return data.data;
    } catch (error) {
        logError('Error listing xAI models', error as Error);
        throw new Error(`Failed to list models: ${error instanceof Error ? error.message : String(error)}`);
    }
}

export function hasApiKey(): boolean {
    // Only check secure storage (no .env fallback)
    return !!getApiKeyForService('xai');
}

/**
 * Validate an API key by making a test request
 */
export async function validateApiKey(apiKey: string): Promise<{ valid: boolean; error?: string }> {
    try {
        log('xAI: Validating API key');

        const response = await fetch('https://api.x.ai/v1/models', {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${apiKey}`,
            },
        });

        if (!response.ok) {
            const errorText = await response.text();
            log('xAI: API key validation failed', { status: response.status, error: errorText });
            return {
                valid: false,
                error: response.status === 401 ? 'Invalid API key' : `API error: ${response.statusText}`
            };
        }

        log('xAI: API key validated successfully');
        return { valid: true };
    } catch (error) {
        logError('xAI: API key validation error', error as Error);
        return {
            valid: false,
            error: `Validation failed: ${error instanceof Error ? error.message : 'Unknown error'}`
        };
    }
}
