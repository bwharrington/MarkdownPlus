/**
 * Model display name utilities — single source of truth for formatting
 * model IDs into human-readable names across main process and renderer.
 */

// Explicit overrides for model IDs that auto-formatting handles poorly.
// Unknown IDs fall through to formatModelName() automatically.
export const MODEL_DISPLAY_OVERRIDES: Record<string, string> = {
    // Claude
    'claude-sonnet-4-6':           'Claude Sonnet 4.6',
    'claude-opus-4-6':             'Claude Opus 4.6',
    'claude-haiku-4-5-20251001':   'Claude Haiku 4.5',
    // xAI
    'grok-4-1-fast-non-reasoning': 'Grok 4.1',
    'grok-4-1-fast-reasoning':     'Grok 4.1 Reasoning',
    'grok-4-0709':                 'Grok 4',
    // OpenAI GPT-5 family (chat completions-compatible only)
    'gpt-5':                       'GPT-5',
    'gpt-5-mini':                  'GPT-5 Mini',
    'gpt-5-nano':                  'GPT-5 Nano',
    'gpt-5.1':                     'GPT-5.1',
    'gpt-5.2':                     'GPT-5.2',
    // OpenAI gpt-4o aliases
    'gpt-4o-latest':               'GPT-4o Latest',
    'gpt-4o-mini-latest':          'GPT-4o Mini Latest',
};

/** Format a model ID into a readable display name (e.g. "grok-4-latest" → "Grok 4 Latest"). */
export function formatModelName(modelId: string): string {
    return modelId
        .replace(/-/g, ' ')
        .replace(/\b\w/g, c => c.toUpperCase())
        .replace(/(\d+)$/g, ' $1')
        .trim();
}

/** Return the display name for a model ID, using overrides where available. */
export function getDisplayName(modelId: string): string {
    return MODEL_DISPLAY_OVERRIDES[modelId] ?? formatModelName(modelId);
}
