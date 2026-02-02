import { log, logError } from '../logger';

export interface Message {
    role: 'user' | 'assistant';
    content: string;
}

export interface OpenAIApiResponse {
    choices: Array<{
        message: {
            content: string;
        };
    }>;
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

// Default models to use if API listing fails (only -latest models)
export const DEFAULT_OPENAI_MODELS = [
    { id: 'gpt-4o-latest', displayName: 'GPT-4 Omni Latest' },
    { id: 'gpt-4o-mini-latest', displayName: 'GPT-4 Omni Mini Latest' },
    { id: 'gpt-4-turbo-latest', displayName: 'GPT-4 Turbo Latest' },
];

export async function callOpenAIApi(messages: Message[], model: string = 'gpt-4o-mini-latest'): Promise<string> {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
        throw new Error('OPENAI_API_KEY not found in environment variables');
    }

    log('OpenAI API Request', {
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
            }),
        });

        log('OpenAI API Response Status', { status: response.status, statusText: response.statusText });

        const data: OpenAIApiResponse = await response.json();

        if (!response.ok) {
            throw new Error(`API request failed with status ${response.status}: ${response.statusText}`);
        }

        return data.choices[0]?.message?.content || 'No response from OpenAI';
    } catch (error) {
        logError('Error calling OpenAI API', error as Error);
        throw new Error(`Failed to call OpenAI API: ${error instanceof Error ? error.message : String(error)}`);
    }
}

export async function listOpenAIModels(): Promise<OpenAIModel[]> {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
        throw new Error('OPENAI_API_KEY not found in environment variables');
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

        // Filter to only GPT chat models with -latest suffix
        return data.data.filter(model =>
            model.id.startsWith('gpt-') && model.id.includes('-latest')
        );
    } catch (error) {
        logError('Error listing OpenAI models', error as Error);
        throw new Error(`Failed to list models: ${error instanceof Error ? error.message : String(error)}`);
    }
}

export function hasApiKey(): boolean {
    return !!process.env.OPENAI_API_KEY;
}
