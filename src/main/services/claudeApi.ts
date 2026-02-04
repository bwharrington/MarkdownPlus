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

export interface ClaudeApiResponse {
    content: Array<{
        text: string;
        type: string;
    }>;
    id: string;
    model: string;
    role: string;
    stop_reason: string;
    stop_sequence: null;
    type: string;
    usage: {
        input_tokens: number;
        output_tokens: number;
    };
}

export interface ClaudeModel {
    id: string;
    created_at: string;
    display_name: string;
    type: string;
}

export interface ListClaudeModelsResponse {
    data: ClaudeModel[];
    first_id: string;
    has_more: boolean;
    last_id: string;
}

// Default models to use if API listing fails
export const DEFAULT_CLAUDE_MODELS = [
    { id: 'claude-sonnet-4-5-20250514', displayName: 'Claude Sonnet 4.5' },
    { id: 'claude-sonnet-4-20250514', displayName: 'Claude Sonnet 4' },
    { id: 'claude-haiku-3-5-20241022', displayName: 'Claude Haiku 3.5' },
];

export async function callClaudeApi(messages: Message[], model: string = 'claude-sonnet-4-5-20250514'): Promise<string> {
    // Only use secure storage (no .env fallback)
    const apiKey = getApiKeyForService('claude'); // || process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
        throw new Error('ANTHROPIC_API_KEY not found. Please set it in Settings');
    }

    // Format messages for Claude API (support attachments)
    const formattedMessages = messages.map(msg => {
        // If message has attachments, use content array format
        if (msg.attachments && msg.attachments.length > 0) {
            const content: any[] = [{ type: 'text', text: msg.content }];

            // Add attachments
            for (const attachment of msg.attachments) {
                if (attachment.type === 'image') {
                    content.push({
                        type: 'image',
                        source: {
                            type: 'base64',
                            media_type: attachment.mimeType,
                            data: attachment.data,
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

    const requestBody = {
        messages: formattedMessages,
        model,
        max_tokens: 4096,
    };

    log('Claude API Request', {
        url: 'https://api.anthropic.com/v1/messages',
        model,
        messageCount: messages.length,
    });

    try {
        const response = await fetch('https://api.anthropic.com/v1/messages', {
            method: 'POST',
            headers: {
                'X-Api-Key': apiKey,
                'Content-Type': 'application/json',
                'anthropic-version': '2023-06-01',
            },
            body: JSON.stringify(requestBody),
        });

        log('Claude API Response Status', { status: response.status, statusText: response.statusText });

        const data: ClaudeApiResponse = await response.json();

        if (!response.ok) {
            throw new Error(`API request failed with status ${response.status}: ${response.statusText}`);
        }

        return data.content[0]?.text || 'No response from Claude';
    } catch (error) {
        logError('Error calling Claude API', error as Error);
        throw new Error(`Failed to call Claude API: ${error instanceof Error ? error.message : String(error)}`);
    }
}

/**
 * Call Claude API with a system prompt for edit mode
 * This is used for structured JSON output when editing files
 */
export async function callClaudeApiWithSystemPrompt(
    messages: Message[],
    systemPrompt: string,
    model: string = 'claude-sonnet-4-5-20250514'
): Promise<string> {
    const apiKey = getApiKeyForService('claude');
    if (!apiKey) {
        throw new Error('ANTHROPIC_API_KEY not found. Please set it in Settings');
    }

    // Format messages for Claude API
    const formattedMessages = messages.map(msg => {
        if (msg.attachments && msg.attachments.length > 0) {
            const content: any[] = [{ type: 'text', text: msg.content }];
            for (const attachment of msg.attachments) {
                if (attachment.type === 'image') {
                    content.push({
                        type: 'image',
                        source: {
                            type: 'base64',
                            media_type: attachment.mimeType,
                            data: attachment.data,
                        },
                    });
                } else if (attachment.type === 'text') {
                    content.push({
                        type: 'text',
                        text: `\n\n[File: ${attachment.name}]\n${attachment.data}`,
                    });
                }
            }
            return { role: msg.role, content };
        }
        return { role: msg.role, content: msg.content };
    });

    const requestBody = {
        messages: formattedMessages,
        model,
        max_tokens: 8192,
        system: systemPrompt,
    };

    log('Claude API Request (with system prompt)', {
        url: 'https://api.anthropic.com/v1/messages',
        model,
        messageCount: messages.length,
    });

    try {
        const response = await fetch('https://api.anthropic.com/v1/messages', {
            method: 'POST',
            headers: {
                'X-Api-Key': apiKey,
                'Content-Type': 'application/json',
                'anthropic-version': '2023-06-01',
            },
            body: JSON.stringify(requestBody),
        });

        log('Claude API Response Status', { status: response.status, statusText: response.statusText });

        const data: ClaudeApiResponse = await response.json();

        if (!response.ok) {
            throw new Error(`API request failed with status ${response.status}: ${response.statusText}`);
        }

        return data.content[0]?.text || 'No response from Claude';
    } catch (error) {
        logError('Error calling Claude API with system prompt', error as Error);
        throw new Error(`Failed to call Claude API: ${error instanceof Error ? error.message : String(error)}`);
    }
}

export async function listClaudeModels(): Promise<ClaudeModel[]> {
    // Only use secure storage (no .env fallback)
    const apiKey = getApiKeyForService('claude'); // || process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
        throw new Error('ANTHROPIC_API_KEY not found. Please set it in Settings');
    }

    log('Claude List Models Request', { url: 'https://api.anthropic.com/v1/models' });

    try {
        const response = await fetch('https://api.anthropic.com/v1/models', {
            method: 'GET',
            headers: {
                'X-Api-Key': apiKey,
                'anthropic-version': '2023-06-01',
            },
        });

        log('Claude List Models Response Status', { status: response.status, statusText: response.statusText });

        const data: ListClaudeModelsResponse = await response.json();

        if (!response.ok) {
            throw new Error(`Failed to list models: ${response.status} ${response.statusText}`);
        }

        return data.data;
    } catch (error) {
        logError('Error listing Claude models', error as Error);
        throw new Error(`Failed to list Claude models: ${error instanceof Error ? error.message : String(error)}`);
    }
}

export function hasApiKey(): boolean {
    // Only check secure storage (no .env fallback)
    return !!getApiKeyForService('claude'); // || process.env.ANTHROPIC_API_KEY);
}

/**
 * Validate an API key by making a test request
 */
export async function validateApiKey(apiKey: string): Promise<{ valid: boolean; error?: string }> {
    try {
        log('Claude: Validating API key');

        const response = await fetch('https://api.anthropic.com/v1/models', {
            method: 'GET',
            headers: {
                'X-Api-Key': apiKey,
                'anthropic-version': '2023-06-01',
            },
        });

        if (!response.ok) {
            const errorText = await response.text();
            log('Claude: API key validation failed', { status: response.status, error: errorText });
            return {
                valid: false,
                error: response.status === 401 ? 'Invalid API key' : `API error: ${response.statusText}`
            };
        }

        log('Claude: API key validated successfully');
        return { valid: true };
    } catch (error) {
        logError('Claude: API key validation error', error as Error);
        return {
            valid: false,
            error: `Validation failed: ${error instanceof Error ? error.message : 'Unknown error'}`
        };
    }
}
