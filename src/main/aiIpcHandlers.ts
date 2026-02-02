import { ipcMain, app } from 'electron';
import * as path from 'path';
import * as fs from 'fs/promises';
import { log, logError } from './logger';
import { callXAiApi, listModels, hasApiKey as hasXaiApiKey, DEFAULT_XAI_MODELS, Message } from './services/xaiApi';
import { callClaudeApi, listClaudeModels, hasApiKey as hasClaudeApiKey, DEFAULT_CLAUDE_MODELS } from './services/claudeApi';
import { callOpenAIApi, listOpenAIModels, hasApiKey as hasOpenAIApiKey, DEFAULT_OPENAI_MODELS } from './services/openaiApi';

export interface AIChatRequestData {
    messages: Message[];
    model: string;
}

export interface AIChatResponse {
    success: boolean;
    response?: string;
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
}

// Helper function to load config and filter enabled models
async function getEnabledModels(provider: 'xai' | 'claude' | 'openai', allModels: AIModelOption[]): Promise<AIModelOption[]> {
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

    // xAI Chat Request
    ipcMain.handle('ai:chat-request', async (_event, data: AIChatRequestData): Promise<AIChatResponse> => {
        log('AI IPC: chat-request', { model: data.model, messageCount: data.messages.length });
        try {
            const response = await callXAiApi(data.messages, data.model);
            return { success: true, response };
        } catch (error) {
            logError('AI IPC: chat-request failed', error as Error);
            return { success: false, error: (error as Error).message };
        }
    });

    // Claude Chat Request
    ipcMain.handle('ai:claude-chat-request', async (_event, data: AIChatRequestData): Promise<AIChatResponse> => {
        log('AI IPC: claude-chat-request', { model: data.model, messageCount: data.messages.length });
        try {
            const response = await callClaudeApi(data.messages, data.model);
            return { success: true, response };
        } catch (error) {
            logError('AI IPC: claude-chat-request failed', error as Error);
            return { success: false, error: (error as Error).message };
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
        log('AI IPC: openai-chat-request', { model: data.model, messageCount: data.messages.length });
        try {
            const response = await callOpenAIApi(data.messages, data.model);
            return { success: true, response };
        } catch (error) {
            logError('AI IPC: openai-chat-request failed', error as Error);
            return { success: false, error: (error as Error).message };
        }
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

    // Get Provider Statuses
    ipcMain.handle('ai:get-provider-status', async (): Promise<AIProviderStatusesResponse> => {
        log('AI IPC: get-provider-status');

        const result: AIProviderStatusesResponse = {
            xai: { enabled: false, status: 'unchecked' },
            claude: { enabled: false, status: 'unchecked' },
            openai: { enabled: false, status: 'unchecked' },
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
