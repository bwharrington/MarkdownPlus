import { log, logError } from '../logger';
import { getApiKeyForService } from '../secureStorageIpcHandlers';
import { filterGeminiModelsFromApi } from '../../shared/modelFilters';

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

// Gemini uses 'model' instead of 'assistant' for the role
type GeminiRole = 'user' | 'model';

interface GeminiPart {
    text?: string;
    inlineData?: {
        mimeType: string;
        data: string;
    };
}

interface GeminiContent {
    role: GeminiRole;
    parts: GeminiPart[];
}

interface GeminiApiResponse {
    candidates: Array<{
        content: {
            parts: Array<{ text: string }>;
        };
        finishReason?: string;
    }>;
}

export interface ChatApiResult {
    content: string;
    truncated: boolean;
}

interface GeminiModel {
    name: string;
    displayName: string;
    supportedGenerationMethods: string[];
}

interface ListGeminiModelsResponse {
    models: GeminiModel[];
    nextPageToken?: string;
}

export interface GeminiModelOption {
    id: string;
    displayName: string;
}

const GEMINI_BASE_URL = 'https://generativelanguage.googleapis.com/v1beta';

// Default models to use if API listing fails
export const DEFAULT_GEMINI_MODELS: GeminiModelOption[] = [
    { id: 'gemini-3-pro-preview', displayName: 'Gemini 3 Pro Preview' },
    { id: 'gemini-3-flash-preview', displayName: 'Gemini 3 Flash Preview' },
];

/**
 * Convert our internal message format to Gemini's contents format.
 * Gemini uses 'model' instead of 'assistant' for role, and a parts array.
 */
function formatMessagesForGemini(messages: Message[]): GeminiContent[] {
    return messages.map(msg => {
        const role: GeminiRole = msg.role === 'assistant' ? 'model' : 'user';
        const parts: GeminiPart[] = [];

        if (msg.content) {
            parts.push({ text: msg.content });
        }

        if (msg.attachments && msg.attachments.length > 0) {
            for (const attachment of msg.attachments) {
                if (attachment.type === 'image' && attachment.mimeType) {
                    parts.push({
                        inlineData: {
                            mimeType: attachment.mimeType,
                            data: attachment.data,
                        },
                    });
                } else if (attachment.type === 'text') {
                    parts.push({ text: `\n\n[File: ${attachment.name}]\n${attachment.data}` });
                }
            }
        }

        return { role, parts };
    });
}

export async function callGeminiApi(
    messages: Message[],
    model: string = 'gemini-2.0-flash',
    signal?: AbortSignal,
    maxTokens?: number,
): Promise<ChatApiResult> {
    const apiKey = getApiKeyForService('gemini');
    if (!apiKey) {
        throw new Error('GEMINI_API_KEY not found. Please set it in Settings');
    }

    const url = `${GEMINI_BASE_URL}/models/${model}:generateContent`;
    const contents = formatMessagesForGemini(messages);

    log('Gemini API Request', { url, model, messageCount: messages.length, maxTokens });

    try {
        const requestBody: Record<string, unknown> = { contents };
        if (maxTokens != null) {
            requestBody.generationConfig = { maxOutputTokens: maxTokens };
        }

        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'x-goog-api-key': apiKey,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(requestBody),
            signal,
        });

        log('Gemini API Response Status', { status: response.status, statusText: response.statusText });

        const data: GeminiApiResponse = await response.json();

        if (!response.ok) {
            throw new Error(`API request failed with status ${response.status}: ${response.statusText}`);
        }

        const truncated = data.candidates?.[0]?.finishReason === 'MAX_TOKENS';
        if (truncated) {
            log('Gemini API: Response was truncated (MAX_TOKENS)', { finishReason: data.candidates?.[0]?.finishReason });
        }
        return {
            content: data.candidates?.[0]?.content?.parts?.[0]?.text || 'No response from Gemini',
            truncated,
        };
    } catch (error) {
        logError('Error calling Gemini API', error as Error);
        throw new Error(`Failed to call Gemini API: ${error instanceof Error ? error.message : String(error)}`);
    }
}

/**
 * Call Gemini API with JSON mode enabled for structured output.
 * Used for edit mode to get guaranteed JSON responses.
 * The system prompt is prepended as the first user message since Gemini
 * does not have a dedicated system role in the generateContent API.
 */
export async function callGeminiApiWithJsonMode(
    messages: Array<{ role: string; content: string }>,
    model: string = 'gemini-2.0-flash',
    signal?: AbortSignal
): Promise<string> {
    const apiKey = getApiKeyForService('gemini');
    if (!apiKey) {
        throw new Error('GEMINI_API_KEY not found. Please set it in Settings');
    }

    const url = `${GEMINI_BASE_URL}/models/${model}:generateContent`;

    // Convert to Gemini format, mapping 'assistant' -> 'model' and 'system' -> prepend to first user message
    const contents: GeminiContent[] = messages
        .filter(m => m.role !== 'system')
        .map(m => ({
            role: (m.role === 'assistant' ? 'model' : 'user') as GeminiRole,
            parts: [{ text: m.content }],
        }));

    log('Gemini API Request (JSON mode)', { url, model, messageCount: messages.length });

    try {
        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'x-goog-api-key': apiKey,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                contents,
                generationConfig: {
                    response_mime_type: 'application/json',
                },
            }),
            signal,
        });

        log('Gemini API Response Status (JSON mode)', { status: response.status, statusText: response.statusText });

        const data: GeminiApiResponse = await response.json();

        if (!response.ok) {
            throw new Error(`API request failed with status ${response.status}: ${response.statusText}`);
        }

        return data.candidates?.[0]?.content?.parts?.[0]?.text || '';
    } catch (error) {
        logError('Error calling Gemini API with JSON mode', error as Error);
        throw new Error(`Failed to call Gemini API: ${error instanceof Error ? error.message : String(error)}`);
    }
}

export async function listGeminiModels(apiKeyOverride?: string): Promise<GeminiModelOption[]> {
    const apiKey = apiKeyOverride ?? getApiKeyForService('gemini');
    if (!apiKey) {
        throw new Error('GEMINI_API_KEY not found. Please set it in Settings');
    }

    const url = `${GEMINI_BASE_URL}/models`;

    log('Gemini List Models Request', { url });

    try {
        const response = await fetch(`${url}?pageSize=100`, {
            method: 'GET',
            headers: {
                'x-goog-api-key': apiKey,
            },
        });

        log('Gemini List Models Response Status', { status: response.status, statusText: response.statusText });

        const data: ListGeminiModelsResponse = await response.json();

        if (!response.ok) {
            throw new Error(`Failed to list models: ${response.status} ${response.statusText}`);
        }

        // Log raw model list for debugging filter behaviour
        log('Gemini List Models Raw Response', {
            totalCount: data.models?.length ?? 0,
            models: (data.models ?? []).map(m => ({
                name: m.name,
                displayName: m.displayName,
                supportedGenerationMethods: m.supportedGenerationMethods,
            })),
        });

        const filtered = filterGeminiModelsFromApi(data.models ?? []);

        log('Gemini List Models Filtered Result', {
            filteredCount: filtered.length,
            models: filtered.map(m => m.id),
        });

        return filtered;
    } catch (error) {
        logError('Error listing Gemini models', error as Error);
        throw new Error(`Failed to list models: ${error instanceof Error ? error.message : String(error)}`);
    }
}

export function hasApiKey(): boolean {
    return !!getApiKeyForService('gemini');
}

/**
 * Validate a Gemini API key by attempting to list models with it.
 */
export async function validateApiKey(apiKey: string): Promise<{ valid: boolean; error?: string }> {
    try {
        log('Gemini: Validating API key');

        await listGeminiModels(apiKey);

        log('Gemini: API key validated successfully');
        return { valid: true };
    } catch (error) {
        logError('Gemini: API key validation error', error as Error);
        const message = error instanceof Error ? error.message : 'Unknown error';
        return {
            valid: false,
            error: message.includes('401') || message.includes('403')
                ? 'Invalid API key'
                : `Validation failed: ${message}`,
        };
    }
}
