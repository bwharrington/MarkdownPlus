import { log, logError } from '../logger';

export interface Message {
    role: 'user' | 'assistant';
    content: string;
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
    const apiKey = process.env.XAI_API_KEY;
    if (!apiKey) {
        throw new Error('XAI_API_KEY not found in environment variables');
    }

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
                messages,
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
    const apiKey = process.env.XAI_API_KEY;
    if (!apiKey) {
        throw new Error('XAI_API_KEY not found in environment variables');
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
    return !!process.env.XAI_API_KEY;
}
