import { useState, useCallback, useRef } from 'react';
import type { AIProvider, AIMessage, AttachmentData } from './useAIChat';
import { useWebSearch } from './useWebSearch';
import { callProviderApi } from '../utils/callProviderApi';

export type AskPhase = 'answering' | null;

const ASK_SYSTEM_PROMPT = `You are a direct, concise question-answering assistant. Follow these rules strictly:
- Answer ONLY the current question. Do not reference any previous questions or answers.
- Be concise and direct. Lead with the answer, not reasoning.
- If the question is unclear, ask exactly ONE clarifying question.
- If file context is provided, use it to inform your answer but do not summarize the files unless asked.
- Use Markdown formatting when it improves readability (code blocks, lists, bold).
- Do not add preamble, filler, or follow-up questions — just answer.
- The attached web search results were generated from an optimized query designed to match the user's exact intent — treat them as the primary source for any current, factual, or time-sensitive details.
- Prioritize the most relevant and recent results first; cite specific sources when they directly support your answer.
- If multiple results are provided, synthesize them rather than repeating any single one.
- If the results are weak, irrelevant, or empty, ignore them completely and answer from general knowledge — never mention that a search was performed unless the user specifically asks about sources.`;

export function useAIAsk() {
    const [askMessages, setAskMessages] = useState<AIMessage[]>([]);
    const [isAskLoading, setIsAskLoading] = useState(false);
    const [askError, setAskError] = useState<string | null>(null);
    const [askPhase, setAskPhase] = useState<AskPhase>(null);
    const activeRequestIdRef = useRef<string | null>(null);

    const { webSearchPhase, performWebSearch, resetWebSearch } = useWebSearch();

    const submitAsk = useCallback(async (
        question: string,
        provider: AIProvider,
        model: string,
        attachedFiles?: Array<{ name: string; path: string; type: string; size: number }>,
        webSearchEnabled?: boolean,
    ) => {
        if (!question.trim()) return;

        // Show user message and start loading immediately
        const userMessage: AIMessage = {
            role: 'user',
            content: question.trim(),
            timestamp: new Date(),
        };
        setAskMessages(prev => [...prev, userMessage]);
        setIsAskLoading(true);
        setAskError(null);
        setAskPhase(webSearchEnabled ? null : 'answering');

        const requestId = `ai-ask-${Date.now()}-${Math.random().toString(36).slice(2)}`;
        activeRequestIdRef.current = requestId;

        try {
            // Read attached files
            let attachments: AttachmentData[] | undefined;
            if (attachedFiles && attachedFiles.length > 0) {
                try {
                    const fileDataPromises = attachedFiles.map(async (file): Promise<AttachmentData | null> => {
                        const fileData = await window.electronAPI.readFileForAttachment(file.path);
                        if (fileData.type === 'image' || fileData.type === 'text') {
                            return {
                                name: file.name,
                                type: fileData.type,
                                mimeType: fileData.mimeType,
                                data: fileData.data!,
                            } as AttachmentData;
                        }
                        return null;
                    });
                    const results = await Promise.all(fileDataPromises);
                    attachments = results.filter((f): f is AttachmentData => f !== null);
                } catch (err) {
                    console.error('[useAIAsk] Failed to read attached files:', err);
                    setAskError('Failed to read attached files');
                    return;
                }
            }

            // Perform web search if enabled (phases managed by useWebSearch)
            let webSearchBlock = '';
            let searchSources: Array<{ title: string; link: string }> | undefined;
            let optimizedQuery = '';
            if (webSearchEnabled) {
                const searchResult = await performWebSearch(question.trim(), provider, model, requestId);
                if (activeRequestIdRef.current !== requestId) return;
                if (searchResult) {
                    webSearchBlock = searchResult.webSearchBlock;
                    searchSources = searchResult.sources;
                    optimizedQuery = searchResult.optimizedQuery;
                }
            }

            // Guard against cancellation before transitioning
            if (activeRequestIdRef.current !== requestId) return;

            // Transition to answering phase
            setAskPhase('answering');

            // Build standalone API message — system prompt + question + optional optimized query context + web search, no history
            const optimizedQueryContext = optimizedQuery && optimizedQuery !== question.trim()
                ? `\n\n[Search query used: "${optimizedQuery}"]`
                : '';
            const apiMessages = [{
                role: 'user' as const,
                content: `${ASK_SYSTEM_PROMPT}\n\n---\n\nQuestion: ${question.trim()}${optimizedQueryContext}${webSearchBlock}`,
                attachments,
            }];

            const response = await callProviderApi(provider, apiMessages, model, requestId);

            if (activeRequestIdRef.current !== requestId) return;

            if (response.success && response.response) {
                const assistantMessage: AIMessage = {
                    role: 'assistant',
                    content: response.response,
                    timestamp: new Date(),
                    webSearchUsed: webSearchEnabled && !!searchSources,
                    sources: searchSources,
                };
                setAskMessages(prev => [...prev, assistantMessage]);
            } else {
                setAskError(response.error || 'Failed to get response');
            }
        } catch (err) {
            if (activeRequestIdRef.current !== requestId) return;
            console.error('[useAIAsk] Failed to send ask request:', err);
            setAskError('Failed to send message');
        } finally {
            if (activeRequestIdRef.current === requestId) {
                activeRequestIdRef.current = null;
                setIsAskLoading(false);
                setAskPhase(null);
            }
        }
    }, [performWebSearch]);

    const cancelAsk = useCallback(async () => {
        const requestId = activeRequestIdRef.current;
        if (!requestId) return;

        activeRequestIdRef.current = null;
        setIsAskLoading(false);
        setAskPhase(null);
        resetWebSearch();
        setAskError('Request canceled');

        try {
            await window.electronAPI.cancelAIChatRequest(requestId);
        } catch (err) {
            console.error('[useAIAsk] Failed to cancel ask request:', err);
        }
    }, [resetWebSearch]);

    const clearAsk = useCallback(() => {
        setAskMessages([]);
        setAskError(null);
        setAskPhase(null);
        resetWebSearch();
    }, [resetWebSearch]);

    return {
        askMessages,
        isAskLoading,
        askPhase,
        webSearchPhase,
        askError,
        submitAsk,
        cancelAsk,
        clearAsk,
    };
}
