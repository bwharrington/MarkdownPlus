/**
 * Model name filters — single source of truth for API services and Settings.
 */

export type AIProvider = 'xai' | 'claude' | 'openai' | 'gemini';

function shouldIncludeClaudeModel(id: string): boolean {
    if (!id.startsWith('claude-')) return false;

    const hasDatestamp = /\d{8}$/.test(id);

    // Sonnet and Opus: keep undated aliases at version 4-6 or higher.
    // Dated snapshots are excluded — they have clean aliases (e.g. claude-sonnet-4-6).
    if (id.startsWith('claude-sonnet-') || id.startsWith('claude-opus-')) {
        if (hasDatestamp) return false;
        const m = /^claude-(?:sonnet|opus)-(\d+)-(\d+)$/.exec(id);
        if (!m) return false;
        const major = parseInt(m[1], 10), minor = parseInt(m[2], 10);
        return major > 4 || (major === 4 && minor >= 6);
    }

    // Haiku: keep the single latest dated snapshot (currently 4-5).
    // When a haiku-4-6+ undated alias appears, it will pass via the block above if we extend it,
    // or fall through here — so we also accept undated haiku at 4-5+.
    if (id.startsWith('claude-haiku-')) {
        const m = /^claude-haiku-(\d+)-(\d+)(?:-\d{8})?$/.exec(id);
        if (!m) return false;
        const major = parseInt(m[1], 10);
        const minor = parseInt(m[2], 10);
        if (major > 4 || (major === 4 && minor >= 5)) {
            // Keep the latest dated snapshot per version; drop older dated ones.
            // Since the API returns only one per version currently, all pass.
            return true;
        }
        return false;
    }

    return false;
}

// Explicit allowlist of GPT-5 family models that support v1/chat/completions.
// Pro, codex, and oss variants are Responses API only and are intentionally excluded.
const OPENAI_GPT5_CHAT_MODELS = new Set([
    'gpt-5',
    'gpt-5-mini',
    'gpt-5-nano',
    'gpt-5.1',
    'gpt-5.2',
]);

function shouldIncludeOpenAIModel(id: string): boolean {
    // ChatGPT-specific aliases are not recommended for API use and duplicate real IDs
    if (id.endsWith('-chat-latest')) return false;

    // GPT-5 family: only explicitly allowlisted models support v1/chat/completions
    if (id.startsWith('gpt-5')) return OPENAI_GPT5_CHAT_MODELS.has(id);

    return (
        // gpt-4o-latest, gpt-4o-mini-latest, etc.
        (id.startsWith('gpt-') && id.endsWith('-latest')) ||
        // o-series reasoning models: o3, o4-mini, o4-pro, etc.
        /^o\d(-mini|-pro)?$/.test(id)
    );
}

function shouldIncludeXaiModel(id: string): boolean {
    return (
        id.startsWith('grok-4') &&
        !id.includes('image') &&
        !id.includes('video') &&
        !id.includes('imagine')
    );
}

function shouldIncludeGeminiModel(id: string): boolean {
    const cleanId = id.replace(/^models\//, '');
    return (
        cleanId.startsWith('gemini-') &&
        !cleanId.includes('embedding') &&
        !cleanId.includes('image') &&
        !/-(exp-)?(\d{2}-\d{2}|\d{4}|\d{6})$/.test(cleanId) &&
        !/-\d{3}(-\w+)?$/.test(cleanId) &&
        !cleanId.endsWith('-latest')
    );
}

export function shouldIncludeModel(provider: AIProvider, modelId: string): boolean {
    switch (provider) {
        case 'claude':
            return shouldIncludeClaudeModel(modelId);
        case 'openai':
            return shouldIncludeOpenAIModel(modelId);
        case 'xai':
            return shouldIncludeXaiModel(modelId);
        case 'gemini':
            return shouldIncludeGeminiModel(modelId);
        default:
            return true;
    }
}

/**
 * Filter a list of model entries (id + config) to only those that pass the provider filter.
 * Used by Settings dialog and anywhere we filter by model ID only.
 */
export function filterModelsForProvider<T extends { id: string }>(
    provider: AIProvider,
    models: T[]
): T[] {
    return models.filter(m => shouldIncludeModel(provider, m.id));
}

/** Gemini API model shape (minimal for filtering) */
export interface GeminiApiModel {
    name: string;
    displayName?: string;
    supportedGenerationMethods?: string[];
}

/**
 * Filter and map Gemini API response to our model format.
 * Includes supportedGenerationMethods check (generateContent) plus ID-based rules.
 */
export function filterGeminiModelsFromApi(
    models: GeminiApiModel[]
): Array<{ id: string; displayName: string }> {
    return models
        .filter(m => {
            const id = m.name.replace(/^models\//, '');
            return (
                (m.supportedGenerationMethods?.includes('generateContent') ?? false) &&
                shouldIncludeGeminiModel(id)
            );
        })
        .map(m => ({
            id: m.name.replace(/^models\//, ''),
            displayName: m.displayName || m.name.replace(/^models\//, ''),
        }));
}
