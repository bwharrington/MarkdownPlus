import { log, logError } from '../logger';

export interface Message {
    role: 'user' | 'assistant';
    content: string;
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
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
        throw new Error('ANTHROPIC_API_KEY not found in environment variables');
    }

    const requestBody = {
        messages,
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

export async function listClaudeModels(): Promise<ClaudeModel[]> {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
        throw new Error('ANTHROPIC_API_KEY not found in environment variables');
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
    return !!process.env.ANTHROPIC_API_KEY;
}
