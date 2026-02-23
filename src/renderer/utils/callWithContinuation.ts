import type { AIChatResponse } from '../types/global';
import type { AIProvider } from '../hooks/useAIChat';
import { closeUnclosedFences } from './sanitizeMarkdown';

type ChatApiFn = (
    provider: AIProvider,
    messages: { role: 'user' | 'assistant'; content: string }[],
    model: string,
    requestId: string,
    maxTokens?: number,
) => Promise<AIChatResponse>;

const CONTINUATION_PROMPT = 'Continue exactly where you left off. Do not repeat any previous content.';
const MAX_CONTINUATIONS = 3;

export interface ContinuationResult {
    content: string;
    continuations: number;
}

/**
 * Wraps a callChatApi function with auto-continuation logic.
 * If the AI response is truncated (finish_reason hit max_tokens), sends
 * follow-up messages to continue generation, up to MAX_CONTINUATIONS total attempts.
 * Each segment is fence-closed before concatenation to prevent broken markdown.
 */
export async function callWithContinuation(
    callChatApi: ChatApiFn,
    provider: AIProvider,
    messages: { role: 'user' | 'assistant'; content: string }[],
    model: string,
    requestId: string,
    logPrefix: string,
    maxTokens?: number,
): Promise<ContinuationResult> {
    const firstResponse = await callChatApi(provider, messages, model, requestId, maxTokens);

    if (!firstResponse.success || !firstResponse.response) {
        throw new Error(firstResponse.error || 'API request failed');
    }

    if (!firstResponse.truncated) {
        return { content: firstResponse.response, continuations: 0 };
    }

    // Build up the full content across continuations
    const segments: string[] = [firstResponse.response];
    let continuations = 0;

    for (let i = 1; i < MAX_CONTINUATIONS; i++) {
        continuations++;
        console.log(`${logPrefix} Response truncated, auto-continuing (${continuations}/${MAX_CONTINUATIONS - 1})`);

        const continuationMessages: { role: 'user' | 'assistant'; content: string }[] = [
            ...messages,
            { role: 'assistant' as const, content: segments.join('') },
            { role: 'user' as const, content: CONTINUATION_PROMPT },
        ];

        const contResponse = await callChatApi(
            provider,
            continuationMessages,
            model,
            `${requestId}-cont-${i}`,
            maxTokens,
        );

        if (!contResponse.success || !contResponse.response) {
            console.error(`${logPrefix} Continuation ${continuations} failed`, contResponse.error);
            break;
        }

        segments.push(contResponse.response);
        console.log(`${logPrefix} Continuation ${continuations} received`, {
            segmentLength: contResponse.response.length,
            totalLength: segments.reduce((sum, s) => sum + s.length, 0),
        });

        if (!contResponse.truncated) {
            break;
        }
    }

    const assembled = segments.join('');
    return { content: closeUnclosedFences(assembled), continuations };
}
