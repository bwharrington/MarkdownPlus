/**
 * Defines which AI providers are restricted from certain chat modes.
 *
 * Add an entry here to prevent a provider from being used in specific modes.
 * The UI will disable the mode option and auto-reset when that provider is selected.
 * The send handler will also enforce these restrictions at runtime.
 *
 * Example restriction:
 *   xai: ['edit']  — xAI cannot use edit mode (no structured output support)
 */

import type { AIProvider } from './hooks/useAIChat';
import type { AIChatMode } from './types/global';
import { isMultiAgentModel } from '../shared/multiAgentUtils';

export type ProviderModeRestrictions = Partial<Record<AIProvider, AIChatMode[]>>;

/**
 * Map of provider → modes that provider does NOT support.
 */
export const PROVIDER_MODE_RESTRICTIONS: ProviderModeRestrictions = {
    // xAI supports edit mode via response_format: json_object on chat completions.
    // Multi-agent models are still restricted via isModelRestrictedFromMode().
};

/**
 * Returns true if the given provider is restricted from the given mode.
 */
export function isProviderRestrictedFromMode(
    provider: AIProvider,
    mode: AIChatMode
): boolean {
    const restricted = PROVIDER_MODE_RESTRICTIONS[provider];
    return restricted ? restricted.includes(mode) : false;
}

/**
 * Returns the list of modes that are restricted for a given provider.
 */
export function getRestrictedModesForProvider(provider: AIProvider): AIChatMode[] {
    return PROVIDER_MODE_RESTRICTIONS[provider] ?? [];
}

/**
 * Returns true if a specific model is restricted from a mode.
 * Multi-agent models do not support edit mode (no structured output/diff support).
 * Create mode is supported — multi-agent can generate new content.
 */
export function isModelRestrictedFromMode(modelId: string, mode: AIChatMode): boolean {
    if (isMultiAgentModel(modelId)) {
        return mode === 'edit';
    }
    return false;
}

/**
 * Returns a human-readable reason why a provider is restricted from a mode.
 */
export function getRestrictionReason(provider: AIProvider, mode: AIChatMode): string {
    return `${provider} does not support ${mode} mode.`;
}
