import { ipcMain, app } from 'electron';
import * as path from 'path';
import * as fs from 'fs/promises';
import { log, logError } from './logger';
import { callXAiApi, listModels, hasApiKey as hasXaiApiKey, DEFAULT_XAI_MODELS, Message } from './services/xaiApi';
import { callClaudeApi, callClaudeApiWithSystemPrompt, listClaudeModels, hasApiKey as hasClaudeApiKey, DEFAULT_CLAUDE_MODELS } from './services/claudeApi';
import { callOpenAIApi, callOpenAIApiWithJsonMode, listOpenAIModels, hasApiKey as hasOpenAIApiKey, DEFAULT_OPENAI_MODELS } from './services/openaiApi';
import { callGeminiApi, callGeminiApiWithJsonMode, listGeminiModels, hasApiKey as hasGeminiApiKey, DEFAULT_GEMINI_MODELS } from './services/geminiApi';

export interface AIChatRequestData {
    messages: Message[];
    model: string;
    requestId?: string;
    maxTokens?: number;
}

export interface AIChatResponse {
    success: boolean;
    response?: string;
    truncated?: boolean;
    error?: string;
}

export interface AIModelOption {
    id: string;
    displayName: string;
}

export interface AIModelsResponse {
    success: boolean;
    models?: AIModelOption[];
    error?: string;
}

export interface AIProviderStatus {
    enabled: boolean;
    status: 'success' | 'error' | 'unchecked';
}

export interface AIProviderStatusesResponse {
    xai: AIProviderStatus;
    claude: AIProviderStatus;
    openai: AIProviderStatus;
    gemini: AIProviderStatus;
}

export interface AIEditRequestData {
    messages: Array<{ role: string; content: string }>;
    model: string;
    provider: 'claude' | 'openai' | 'gemini';
    requestId?: string;
}

export interface AIEditResponse {
    success: boolean;
    modifiedContent?: string;
    summary?: string;
    error?: string;
}

// System prompt for AI edit mode - instructs AI to return JSON
const DIFF_EDIT_SYSTEM_PROMPT = `You are helping edit a markdown document. The user will provide the current document content and request specific changes.

CRITICAL: Your ENTIRE response must be a single, raw JSON object. Do NOT include any text, explanation, or commentary before or after the JSON. Do NOT wrap the JSON in markdown code fences (\`\`\`). Output ONLY the JSON object.

RULES:
1. Return a JSON object with "modifiedContent" (the complete modified document) and "summary" (brief description of changes)
2. Preserve all content that the user did not ask to change
3. Maintain the exact formatting, indentation, and line endings of unchanged sections
4. Make ONLY the changes the user explicitly requested
5. The modifiedContent must be the complete document, not a partial diff
6. Your response MUST be valid JSON and nothing else - no preamble, no explanation, no code fences

Example response format:
{
  "modifiedContent": "# Title\\n\\nUpdated content here...",
  "summary": "Added a new section about X and fixed typo in paragraph 2"
}`;

// Helper function to load config and filter enabled models
async function getEnabledModels(provider: 'xai' | 'claude' | 'openai' | 'gemini', allModels: AIModelOption[]): Promise<AIModelOption[]> {
    try {
        const configPath = path.join(app.getPath('userData'), 'config.json');
        const data = await fs.readFile(configPath, 'utf-8');
        const config = JSON.parse(data);

        // If no aiModels config exists, return all models (default behavior)
        if (!config.aiModels || !config.aiModels[provider]) {
            return allModels;
        }

        // Filter models based on enabled flag in config
        const enabledModels = allModels.filter(model => {
            const modelConfig = config.aiModels[provider][model.id];
            // If model not in config or explicitly enabled, include it
            return !modelConfig || modelConfig.enabled !== false;
        });

        log(`Filtered ${provider} models`, { total: allModels.length, enabled: enabledModels.length });
        return enabledModels;
    } catch (error) {
        // If config can't be read, return all models
        logError(`Failed to load config for filtering ${provider} models, returning all`, error as Error);
        return allModels;
    }
}

export function registerAIIpcHandlers() {
    log('Registering AI IPC handlers');
    const activeChatRequests = new Map<string, AbortController>();

    const getControllerForRequest = (requestId?: string): AbortController | undefined => {
        if (!requestId) {
            return undefined;
        }
        const controller = new AbortController();
        activeChatRequests.set(requestId, controller);
        return controller;
    };

    const finalizeRequest = (requestId?: string) => {
        if (requestId) {
            activeChatRequests.delete(requestId);
        }
    };

    // xAI Chat Request
    ipcMain.handle('ai:chat-request', async (_event, data: AIChatRequestData): Promise<AIChatResponse> => {
        log('AI IPC: chat-request', { model: data.model, messageCount: data.messages.length, maxTokens: data.maxTokens });
        const controller = getControllerForRequest(data.requestId);
        try {
            const result = await callXAiApi(data.messages, data.model, controller?.signal, data.maxTokens);
            return { success: true, response: result.content, truncated: result.truncated };
        } catch (error) {
            logError('AI IPC: chat-request failed', error as Error);
            return { success: false, error: (error as Error).message };
        } finally {
            finalizeRequest(data.requestId);
        }
    });

    // Claude Chat Request
    ipcMain.handle('ai:claude-chat-request', async (_event, data: AIChatRequestData): Promise<AIChatResponse> => {
        log('AI IPC: claude-chat-request', { model: data.model, messageCount: data.messages.length, maxTokens: data.maxTokens });
        const controller = getControllerForRequest(data.requestId);
        try {
            const result = await callClaudeApi(data.messages, data.model, controller?.signal, data.maxTokens);
            return { success: true, response: result.content, truncated: result.truncated };
        } catch (error) {
            logError('AI IPC: claude-chat-request failed', error as Error);
            return { success: false, error: (error as Error).message };
        } finally {
            finalizeRequest(data.requestId);
        }
    });

    // List xAI Models
    ipcMain.handle('ai:list-models', async (): Promise<AIModelsResponse> => {
        log('AI IPC: list-models');
        try {
            const models = await listModels();
            const modelOptions: AIModelOption[] = models.map(m => ({
                id: m.id,
                displayName: formatModelName(m.id),
            }));
            const enabledModels = await getEnabledModels('xai', modelOptions);
            return { success: true, models: enabledModels };
        } catch (error) {
            logError('AI IPC: list-models failed, using defaults', error as Error);
            // Return default models on error
            const enabledModels = await getEnabledModels('xai', DEFAULT_XAI_MODELS);
            return { success: true, models: enabledModels };
        }
    });

    // List Claude Models
    ipcMain.handle('ai:list-claude-models', async (): Promise<AIModelsResponse> => {
        log('AI IPC: list-claude-models');
        try {
            const models = await listClaudeModels();
            const modelOptions: AIModelOption[] = models.map(m => ({
                id: m.id,
                displayName: m.display_name || formatModelName(m.id),
            }));
            const enabledModels = await getEnabledModels('claude', modelOptions);
            return { success: true, models: enabledModels };
        } catch (error) {
            logError('AI IPC: list-claude-models failed, using defaults', error as Error);
            // Return default models on error
            const enabledModels = await getEnabledModels('claude', DEFAULT_CLAUDE_MODELS);
            return { success: true, models: enabledModels };
        }
    });

    // OpenAI Chat Request
    ipcMain.handle('ai:openai-chat-request', async (_event, data: AIChatRequestData): Promise<AIChatResponse> => {
        log('AI IPC: openai-chat-request', { model: data.model, messageCount: data.messages.length, maxTokens: data.maxTokens });
        const controller = getControllerForRequest(data.requestId);
        try {
            const result = await callOpenAIApi(data.messages, data.model, controller?.signal, data.maxTokens);
            return { success: true, response: result.content, truncated: result.truncated };
        } catch (error) {
            logError('AI IPC: openai-chat-request failed', error as Error);
            return { success: false, error: (error as Error).message };
        } finally {
            finalizeRequest(data.requestId);
        }
    });

    // Gemini Chat Request
    ipcMain.handle('ai:gemini-chat-request', async (_event, data: AIChatRequestData): Promise<AIChatResponse> => {
        log('AI IPC: gemini-chat-request', { model: data.model, messageCount: data.messages.length, maxTokens: data.maxTokens });
        const controller = getControllerForRequest(data.requestId);
        try {
            const result = await callGeminiApi(data.messages, data.model, controller?.signal, data.maxTokens);
            return { success: true, response: result.content, truncated: result.truncated };
        } catch (error) {
            logError('AI IPC: gemini-chat-request failed', error as Error);
            return { success: false, error: (error as Error).message };
        } finally {
            finalizeRequest(data.requestId);
        }
    });

    // List Gemini Models
    ipcMain.handle('ai:list-gemini-models', async (): Promise<AIModelsResponse> => {
        log('AI IPC: list-gemini-models');
        try {
            const models = await listGeminiModels();
            const enabledModels = await getEnabledModels('gemini', models);
            return { success: true, models: enabledModels };
        } catch (error) {
            logError('AI IPC: list-gemini-models failed, using defaults', error as Error);
            const enabledModels = await getEnabledModels('gemini', DEFAULT_GEMINI_MODELS);
            return { success: true, models: enabledModels };
        }
    });

    // Cancel in-flight chat request
    ipcMain.handle('ai:cancel-request', async (_event, requestId: string) => {
        const controller = activeChatRequests.get(requestId);
        if (!controller) {
            return { success: true, cancelled: false };
        }
        controller.abort();
        activeChatRequests.delete(requestId);
        return { success: true, cancelled: true };
    });

    // Cancel in-flight edit request
    ipcMain.handle('ai:cancel-edit-request', async (_event, requestId: string) => {
        const controller = activeChatRequests.get(requestId);
        if (!controller) {
            return { success: true, cancelled: false };
        }
        controller.abort();
        activeChatRequests.delete(requestId);
        return { success: true, cancelled: true };
    });

    // List OpenAI Models
    ipcMain.handle('ai:list-openai-models', async (): Promise<AIModelsResponse> => {
        log('AI IPC: list-openai-models');
        try {
            const models = await listOpenAIModels();
            const modelOptions: AIModelOption[] = models.map(m => ({
                id: m.id,
                displayName: formatModelName(m.id),
            }));
            const enabledModels = await getEnabledModels('openai', modelOptions);
            return { success: true, models: enabledModels };
        } catch (error) {
            logError('AI IPC: list-openai-models failed, using defaults', error as Error);
            // Return default models on error
            const enabledModels = await getEnabledModels('openai', DEFAULT_OPENAI_MODELS);
            return { success: true, models: enabledModels };
        }
    });

    // AI Edit Request (structured output for Claude and OpenAI only)
    ipcMain.handle('ai:edit-request', async (_event, data: AIEditRequestData): Promise<AIEditResponse> => {
        log('AI IPC: edit-request', { provider: data.provider, model: data.model, messageCount: data.messages.length });
        const controller = getControllerForRequest(data.requestId);

        try {
            let response: string;

            if (data.provider === 'claude') {
                // Claude with system prompt
                const claudeMessages = data.messages.map(m => ({
                    role: m.role as 'user' | 'assistant',
                    content: m.content,
                }));
                const result = await callClaudeApiWithSystemPrompt(claudeMessages, DIFF_EDIT_SYSTEM_PROMPT, data.model, controller?.signal);
                response = result.content;
            } else if (data.provider === 'openai') {
                // OpenAI with JSON mode
                const openaiMessages = [
                    { role: 'system', content: DIFF_EDIT_SYSTEM_PROMPT },
                    ...data.messages
                ];
                response = await callOpenAIApiWithJsonMode(openaiMessages, data.model, controller?.signal);
            } else if (data.provider === 'gemini') {
                // Gemini with JSON mode — system prompt is prepended as the first user message
                // since Gemini's generateContent API does not have a dedicated system role
                const geminiMessages = [
                    { role: 'user', content: DIFF_EDIT_SYSTEM_PROMPT },
                    ...data.messages,
                ];
                response = await callGeminiApiWithJsonMode(geminiMessages, data.model, controller?.signal);
            } else {
                return { success: false, error: `Unknown provider: ${data.provider}` };
            }

            // Parse JSON response - robust extraction that handles preamble text and code fences
            let jsonStr = '';
            
            try {
                // Log the raw response for debugging
                log('AI IPC: Raw edit response received', { 
                    provider: data.provider,
                    responseLength: response.length,
                    responsePreview: response.substring(0, 500) + (response.length > 500 ? '...' : '')
                });

                jsonStr = response.trim();

                // Strategy 1: Try parsing as-is first (ideal case: pure JSON)
                let parsed: { modifiedContent?: string; summary?: string } | null = null;
                try {
                    parsed = JSON.parse(jsonStr);
                } catch {
                    // Not pure JSON, try extraction strategies
                }

                // Strategy 2: Strip markdown code fences (```json ... ``` or ``` ... ```)
                if (!parsed) {
                    let stripped = jsonStr;
                    if (stripped.startsWith('```json')) {
                        stripped = stripped.slice(7);
                    } else if (stripped.startsWith('```')) {
                        stripped = stripped.slice(3);
                    }
                    if (stripped.endsWith('```')) {
                        stripped = stripped.slice(0, -3);
                    }
                    stripped = stripped.trim();
                    try {
                        parsed = JSON.parse(stripped);
                        jsonStr = stripped;
                    } catch {
                        // Still not valid, try next strategy
                    }
                }

                // Strategy 3: Extract JSON object from anywhere in the response
                // (handles preamble text, code fences mid-response, etc.)
                if (!parsed) {
                    const firstBrace = response.indexOf('{');
                    const lastBrace = response.lastIndexOf('}');
                    if (firstBrace !== -1 && lastBrace > firstBrace) {
                        const extracted = response.substring(firstBrace, lastBrace + 1);
                        try {
                            parsed = JSON.parse(extracted);
                            jsonStr = extracted;
                        } catch {
                            // Extraction failed too
                        }
                    }
                }

                if (!parsed) {
                    throw new SyntaxError('Could not extract valid JSON from AI response');
                }

                log('AI IPC: Cleaned JSON string for parsing', {
                    cleanedLength: jsonStr.length,
                    cleanedPreview: jsonStr.substring(0, 500) + (jsonStr.length > 500 ? '...' : '')
                });

                if (!parsed.modifiedContent) {
                    log('AI IPC: Parsed JSON missing modifiedContent field', { parsedKeys: Object.keys(parsed) });
                    return {
                        success: false,
                        error: 'AI response missing modifiedContent field'
                    };
                }

                log('AI IPC: Successfully parsed edit response', {
                    hasModifiedContent: !!parsed.modifiedContent,
                    hasSummary: !!parsed.summary,
                    modifiedContentLength: parsed.modifiedContent?.length || 0
                });

                return {
                    success: true,
                    modifiedContent: parsed.modifiedContent,
                    summary: parsed.summary || 'Changes applied'
                };
            } catch (parseError) {
                // Write the full response to a separate file for debugging
                const fsSync = require('fs');
                const pathMod = require('path');
                const debugPath = pathMod.join(app.getPath('userData'), 'ai-response-debug.txt');
                try {
                    fsSync.writeFileSync(debugPath, `=== Failed AI Edit Response ===\nTimestamp: ${new Date().toISOString()}\nProvider: ${data.provider}\nModel: ${data.model}\nResponse Length: ${response.length}\nCleaned Length: ${jsonStr.length}\n\n=== RAW RESPONSE ===\n${response}\n\n=== CLEANED JSON STRING ===\n${jsonStr}\n\n=== PARSE ERROR ===\n${parseError}\n`, 'utf-8');
                    log('AI IPC: Full response written to debug file', { debugPath, responseLength: response.length, cleanedLength: jsonStr.length });
                } catch (writeError) {
                    logError('Failed to write debug file', writeError as Error);
                }
                
                logError('AI IPC: Failed to parse edit response as JSON', parseError as Error);
                return {
                    success: false,
                    error: `Failed to parse AI response as JSON. The AI may not have returned valid JSON. Debug file: ${debugPath}`
                };
            }
        } catch (error) {
            logError('AI IPC: edit-request failed', error as Error);
            return { success: false, error: (error as Error).message };
        } finally {
            finalizeRequest(data.requestId);
        }
    });

    // Get Provider Statuses
    ipcMain.handle('ai:get-provider-status', async (): Promise<AIProviderStatusesResponse> => {
        log('AI IPC: get-provider-status');

        const result: AIProviderStatusesResponse = {
            xai: { enabled: false, status: 'unchecked' },
            claude: { enabled: false, status: 'unchecked' },
            openai: { enabled: false, status: 'unchecked' },
            gemini: { enabled: false, status: 'unchecked' },
        };

        // Check xAI
        if (hasXaiApiKey()) {
            result.xai.enabled = true;
            try {
                await listModels();
                result.xai.status = 'success';
            } catch {
                result.xai.status = 'error';
            }
        }

        // Check Claude
        if (hasClaudeApiKey()) {
            result.claude.enabled = true;
            try {
                await listClaudeModels();
                result.claude.status = 'success';
            } catch {
                result.claude.status = 'error';
            }
        }

        // Check OpenAI
        if (hasOpenAIApiKey()) {
            result.openai.enabled = true;
            try {
                await listOpenAIModels();
                result.openai.status = 'success';
            } catch {
                result.openai.status = 'error';
            }
        }

        // Check Gemini
        if (hasGeminiApiKey()) {
            result.gemini.enabled = true;
            try {
                await listGeminiModels();
                result.gemini.status = 'success';
            } catch {
                result.gemini.status = 'error';
            }
        }

        log('AI IPC: provider status result', result);
        return result;
    });

    log('AI IPC handlers registered');
}

// Format model ID to display name
function formatModelName(modelId: string): string {
    // Handle common patterns
    return modelId
        .replace(/-/g, ' ')
        .replace(/\b\w/g, c => c.toUpperCase())
        .replace(/(\d+)$/g, ' $1')
        .trim();
}
