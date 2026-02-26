import { log, logError } from '../logger';
import { getApiKeyForService } from '../secureStorageIpcHandlers';
import { filterModelsForProvider } from '../../shared/modelFilters';

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

type OpenAIContentBlock =
    | { type: 'text'; text: string }
    | { type: 'image_url'; image_url: { url: string } };

export interface OpenAIApiResponse {
    choices: Array<{
        message: {
            content: string;
        };
        finish_reason?: string;
    }>;
}

export interface ChatApiResult {
    content: string;
    truncated: boolean;
}

export interface OpenAIModel {
    id: string;
    object: string;
    created?: number;
    owned_by?: string;
}

export interface ListModelsResponse {
    object: string;
    data: OpenAIModel[];
}

// Default models to use if API listing fails
export const DEFAULT_OPENAI_MODELS = [
    { id: 'gpt-4o-latest', displayName: 'GPT-4o Latest' },
    { id: 'gpt-4o-mini-latest', displayName: 'GPT-4o Mini Latest' },
    { id: 'o3', displayName: 'o3' },
    { id: 'o4-mini', displayName: 'o4 Mini' },
];

export async function callOpenAIApi(
    messages: Message[],
    model: string = 'gpt-4o-mini-latest',
    signal?: AbortSignal,
    maxTokens?: number,
): Promise<ChatApiResult> {
    // Only use secure storage (no .env fallback)
    const apiKey = getApiKeyForService('openai');
    if (!apiKey) {
        throw new Error('OPENAI_API_KEY not found. Please set it in Settings');
    }

    // Format messages for OpenAI API (support attachments)
    const formattedMessages = messages.map(msg => {
        // If message has attachments, use content array format
        if (msg.attachments && msg.attachments.length > 0) {
            const content: OpenAIContentBlock[] = [{ type: 'text', text: msg.content }];

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

    log('OpenAI API Request', {
        url: 'https://api.openai.com/v1/chat/completions',
        model,
        messageCount: messages.length,
        maxTokens,
    });

    try {
        const requestBody: Record<string, unknown> = {
            messages: formattedMessages,
            model,
        };
        if (maxTokens != null) {
            requestBody.max_tokens = maxTokens;
        }

        const response = await fetch('https://api.openai.com/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${apiKey}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(requestBody),
            signal,
        });

        log('OpenAI API Response Status', { status: response.status, statusText: response.statusText });

        const data: OpenAIApiResponse = await response.json();

        if (!response.ok) {
            throw new Error(`API request failed with status ${response.status}: ${response.statusText}`);
        }

        const truncated = data.choices[0]?.finish_reason === 'length';
        if (truncated) {
            log('OpenAI API: Response was truncated (length)', { finish_reason: data.choices[0]?.finish_reason });
        }
        return {
            content: data.choices[0]?.message?.content || 'No response from OpenAI',
            truncated,
        };
    } catch (error) {
        logError('Error calling OpenAI API', error as Error);
        throw new Error(`Failed to call OpenAI API: ${error instanceof Error ? error.message : String(error)}`);
    }
}

/**
 * Call OpenAI API with JSON mode enabled for structured output
 * This is used for edit mode to get guaranteed JSON responses
 */
export async function callOpenAIApiWithJsonMode(
    messages: Array<{ role: string; content: string }>,
    model: string = 'gpt-4o-mini-latest',
    signal?: AbortSignal
): Promise<string> {
    const apiKey = getApiKeyForService('openai');
    if (!apiKey) {
        throw new Error('OPENAI_API_KEY not found. Please set it in Settings');
    }

    log('OpenAI API Request (JSON mode)', {
        url: 'https://api.openai.com/v1/chat/completions',
        model,
        messageCount: messages.length,
    });

    try {
        const response = await fetch('https://api.openai.com/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${apiKey}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                messages,
                model,
                response_format: { type: 'json_object' },
            }),
            signal,
        });

        log('OpenAI API Response Status (JSON mode)', { status: response.status, statusText: response.statusText });

        const data: OpenAIApiResponse = await response.json();

        if (!response.ok) {
            throw new Error(`API request failed with status ${response.status}: ${response.statusText}`);
        }

        return data.choices[0]?.message?.content || '';
    } catch (error) {
        logError('Error calling OpenAI API with JSON mode', error as Error);
        throw new Error(`Failed to call OpenAI API: ${error instanceof Error ? error.message : String(error)}`);
    }
}

export async function listOpenAIModels(): Promise<OpenAIModel[]> {
    // Only use secure storage (no .env fallback)
    const apiKey = getApiKeyForService('openai');
    if (!apiKey) {
        throw new Error('OPENAI_API_KEY not found. Please set it in Settings');
    }

    log('OpenAI List Models Request', { url: 'https://api.openai.com/v1/models' });

    try {
        const response = await fetch('https://api.openai.com/v1/models', {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${apiKey}`,
            },
        });

        log('OpenAI List Models Response Status', { status: response.status, statusText: response.statusText });

        const data: ListModelsResponse = await response.json();

        if (!response.ok) {
            throw new Error(`Failed to list models: ${response.status} ${response.statusText}`);
        }

        // Log raw model list for debugging filter behaviour
        log('OpenAI List Models Raw Response', {
            totalCount: data.data?.length ?? 0,
            models: (data.data ?? []).map(m => m.id),
        });

        const filtered = filterModelsForProvider('openai', data.data ?? []);

        log('OpenAI List Models Filtered Result', {
            filteredCount: filtered.length,
            models: filtered.map(m => m.id),
        });

        return filtered;
    } catch (error) {
        logError('Error listing OpenAI models', error as Error);
        throw new Error(`Failed to list models: ${error instanceof Error ? error.message : String(error)}`);
    }
}

export function hasApiKey(): boolean {
    // Only check secure storage (no .env fallback)
    return !!getApiKeyForService('openai');
}

/**
 * Validate an API key by making a test request
 */
export async function validateApiKey(apiKey: string): Promise<{ valid: boolean; error?: string }> {
    try {
        log('OpenAI: Validating API key');

        const response = await fetch('https://api.openai.com/v1/models', {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${apiKey}`,
            },
        });

        if (!response.ok) {
            const errorText = await response.text();
            log('OpenAI: API key validation failed', { status: response.status, error: errorText });
            return {
                valid: false,
                error: response.status === 401 ? 'Invalid API key' : `API error: ${response.statusText}`
            };
        }

        log('OpenAI: API key validated successfully');
        return { valid: true };
    } catch (error) {
        logError('OpenAI: API key validation error', error as Error);
        return {
            valid: false,
            error: `Validation failed: ${error instanceof Error ? error.message : 'Unknown error'}`
        };
    }
}
