import { useState, useCallback } from 'react';
import type { AIProvider } from './useAIChat';
import { callProviderApi } from '../utils/callProviderApi';

export type WebSearchPhase = 'optimizing' | 'searching' | null;

export interface WebSearchResult {
    /** Formatted text block to inject into any mode's prompt */
    webSearchBlock: string;
    /** Source attribution for UI display */
    sources: Array<{ title: string; link: string }>;
    /** The optimized query that was actually searched */
    optimizedQuery: string;
}

// --- Search Query Optimizer Prompt ---

const SEARCH_QUERY_OPTIMIZER_PROMPT = `You are an expert search query engineer focused on maximum relevance and freshness. Your task is to transform a user's natural-language question into optimized web search queries.

Analyze the user's question for core intent, key entities, ambiguity, and time sensitivity. Then return ONLY a JSON object with no other text, in this exact format:
{"primary":"optimized search query here","fallback":"broader alternative query here"}

Rules:
- Add precise keywords, proper nouns, and technical terms.
- Include recency signals when implied (e.g., "2025", "latest", "current").
- Use quotation marks for exact phrases when beneficial.
- Add site: or filetype: filters only if clearly beneficial.
- Keep each query short and natural (under 12-15 words when possible).
- Preserve original user intent — never add assumptions or extra topics.
- The fallback query should be a broader variation in case the primary is too narrow.

Examples:
User: "What's the best way to deploy a Next.js app?"
{"primary":"best practices deploy Next.js app 2025 production","fallback":"Next.js deployment guide"}

User: "Did OpenAI release anything new recently?"
{"primary":"OpenAI latest release announcement 2025","fallback":"OpenAI recent news updates"}

User: "How do I fix memory leaks in Node?"
{"primary":"fix memory leak Node.js debugging guide","fallback":"Node.js memory leak troubleshooting"}`;

// --- Result Formatting ---

function formatWebSearchResults(results: Array<{ title: string; snippet: string; link: string }>): string {
    const lines = results.map((r, i) => `[${i + 1}] ${r.title}\n${r.snippet}\nSource: ${r.link}`);
    return `\n\nWEB SEARCH RESULTS (use only for this question):\n\n${lines.join('\n\n')}`;
}

// --- Hook ---

export function useWebSearch() {
    const [webSearchPhase, setWebSearchPhase] = useState<WebSearchPhase>(null);

    const performWebSearch = useCallback(async (
        question: string,
        provider: AIProvider,
        model: string,
        requestId: string,
    ): Promise<WebSearchResult | null> => {
        // Step 1: Optimize the search query using a lightweight AI call
        setWebSearchPhase('optimizing');
        let optimizedQuery = question.trim();

        try {
            const optimizerMessages = [{
                role: 'user' as const,
                content: `${SEARCH_QUERY_OPTIMIZER_PROMPT}\n\nUser question: ${question.trim()}`,
            }];

            const optimizerResponse = await callProviderApi(
                provider, optimizerMessages, model, `${requestId}-opt`,
            );

            if (optimizerResponse.success && optimizerResponse.response) {
                try {
                    // Extract JSON from the response (handle markdown code fences)
                    const raw = optimizerResponse.response.trim();
                    const jsonMatch = raw.match(/\{[\s\S]*\}/);
                    if (jsonMatch) {
                        const parsed = JSON.parse(jsonMatch[0]);
                        optimizedQuery = parsed.primary || question.trim();
                    }
                } catch {
                    console.warn('[useWebSearch] Failed to parse optimizer response, using original question');
                }
            }
        } catch (err) {
            console.warn('[useWebSearch] Query optimization failed, using original question:', err);
        }

        // Step 2: Perform web search with the optimized query
        setWebSearchPhase('searching');

        try {
            const searchResponse = await window.electronAPI.webSearch(optimizedQuery, 5);
            if (searchResponse.success && searchResponse.results && searchResponse.results.length > 0) {
                const results = searchResponse.results.slice(0, 5);
                const webSearchBlock = formatWebSearchResults(results);
                const sources = results.slice(0, 3).map(r => ({ title: r.title, link: r.link }));

                setWebSearchPhase(null);
                return { webSearchBlock, sources, optimizedQuery };
            }
        } catch (err) {
            console.error('[useWebSearch] Web search failed:', err);
        }

        setWebSearchPhase(null);
        return null;
    }, []);

    const resetWebSearch = useCallback(() => {
        setWebSearchPhase(null);
    }, []);

    return {
        webSearchPhase,
        performWebSearch,
        resetWebSearch,
    };
}
