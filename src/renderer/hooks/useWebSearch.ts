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

/** Document metadata for edit-mode-aware query optimization */
export interface WebSearchDocumentContext {
    fileName: string;
    headings: string[];
    topicSummary: string;
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

// --- Edit-Mode Document-Aware Query Optimizer Prompt ---

function buildEditQueryOptimizerPrompt(documentContext: WebSearchDocumentContext): string {
    return `You are optimizing web search queries to find reference material for editing a document.

Document being edited: "${documentContext.fileName}"
Document topic (from headings): ${documentContext.headings.slice(0, 5).join(', ') || 'unknown'}

Determine if this edit needs a single search or multiple searches to gather sufficient context.

Rules:
- Be domain-specific: include the document's topic area in each query
- Add precise keywords, proper nouns, and technical terms from both the edit request AND the document context
- Include recency signals when the edit implies current information (e.g., "2026", "latest")
- Keep each query short and natural (under 12-15 words)
- For simple edits (adding a paragraph, updating a fact): return 1 query
- For complex edits (comparison tables, multi-topic sections, comprehensive guides): return 2-3 queries covering different aspects
- Each query should be specific and non-overlapping

Return a JSON object in one of these formats:

Single query: { "primary": "specific query", "fallback": "broader query" }
Multiple queries: { "queries": [{ "primary": "query 1" }, { "primary": "query 2" }], "fallback": "broader single query" }

Return ONLY the JSON object, nothing else`;
}

/** Maximum total character length for web context to avoid token overflow */
const MAX_WEB_CONTEXT_LENGTH = 6000;

// --- Relevance Filtering (Approach B: LLM-based) ---

async function filterResultsWithAI(
    results: Array<{ title: string; snippet: string; link: string }>,
    editInstruction: string,
    documentTopic: string,
    provider: AIProvider,
    model: string,
    requestId: string,
): Promise<Array<{ title: string; snippet: string; link: string }>> {
    const filterPrompt = `Given these search results, return ONLY the indices (0-based) of results that are relevant to editing a document about "${documentTopic}" with the instruction: "${editInstruction}".

Results:
${results.map((r, i) => `[${i}] ${r.title}: ${r.snippet}`).join('\n')}

Return a JSON array of relevant indices, e.g., [0, 2]. If none are relevant, return [].
Return ONLY the JSON array, nothing else.`;

    try {
        const filterResponse = await callProviderApi(
            provider,
            [{ role: 'user' as const, content: filterPrompt }],
            model,
            `${requestId}-filter`,
        );

        if (filterResponse.success && filterResponse.response) {
            const raw = filterResponse.response.trim();
            const arrayMatch = raw.match(/\[[\s\S]*\]/);
            if (arrayMatch) {
                const indices: unknown[] = JSON.parse(arrayMatch[0]);
                const filtered = indices
                    .filter((i): i is number => typeof i === 'number' && i >= 0 && i < results.length)
                    .map(i => results[i]);
                console.log(`[useWebSearch] AI filter: kept ${filtered.length}/${results.length} results`);
                return filtered;
            }
        }
    } catch (err) {
        console.warn('[useWebSearch] AI relevance filter failed, using all results:', err);
    }

    // Fallback: return all results if the filter call fails
    return results;
}

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
        documentContext?: WebSearchDocumentContext,
    ): Promise<WebSearchResult | null> => {
        // Step 1: Optimize the search query using a lightweight AI call
        setWebSearchPhase('optimizing');
        let optimizedQueries: string[] = [question.trim()];
        let fallbackQuery = question.trim();

        try {
            // Use document-aware prompt when document context is provided (Edit mode)
            const optimizerPrompt = documentContext
                ? buildEditQueryOptimizerPrompt(documentContext)
                : SEARCH_QUERY_OPTIMIZER_PROMPT;

            const optimizerMessages = [{
                role: 'user' as const,
                content: `${optimizerPrompt}\n\nUser question: ${question.trim()}`,
            }];

            const optimizerResponse = await callProviderApi(
                provider, optimizerMessages, model, `${requestId}-opt`,
            );

            if (optimizerResponse.success && optimizerResponse.response) {
                try {
                    const raw = optimizerResponse.response.trim();
                    const jsonMatch = raw.match(/\{[\s\S]*\}/);
                    if (jsonMatch) {
                        const parsed = JSON.parse(jsonMatch[0]);

                        if (parsed.queries && Array.isArray(parsed.queries)) {
                            // Multi-query response
                            optimizedQueries = parsed.queries
                                .map((q: { primary?: string }) => q.primary)
                                .filter(Boolean)
                                .slice(0, 3);
                            fallbackQuery = parsed.fallback || question.trim();
                            console.log(`[useWebSearch] Multi-query: generated ${optimizedQueries.length} queries`);
                        } else if (parsed.primary) {
                            // Single-query response
                            optimizedQueries = [parsed.primary];
                            fallbackQuery = parsed.fallback || question.trim();
                        }
                    }
                } catch {
                    console.warn('[useWebSearch] Failed to parse optimizer response, using original question');
                }
            }
        } catch (err) {
            console.warn('[useWebSearch] Query optimization failed, using original question:', err);
        }

        if (optimizedQueries.length === 0) {
            optimizedQueries = [fallbackQuery];
        }

        // Step 2: Perform web search (single or parallel multi-query)
        setWebSearchPhase('searching');

        try {
            type SearchResult = { title: string; snippet: string; link: string };
            let allResults: SearchResult[] = [];

            if (optimizedQueries.length === 1) {
                // Single query path (original behavior)
                const searchResponse = await window.electronAPI.webSearch(optimizedQueries[0], 5);
                if (searchResponse.success && searchResponse.results) {
                    allResults = searchResponse.results.slice(0, 5);
                }
            } else {
                // Multi-query: execute in parallel, 3 results per query
                const searchPromises = optimizedQueries.map(q =>
                    window.electronAPI.webSearch(q, 3),
                );
                const responses = await Promise.all(searchPromises);

                // Deduplicate by URL
                const seen = new Set<string>();
                for (const resp of responses) {
                    if (resp.success && resp.results) {
                        for (const result of resp.results) {
                            if (!seen.has(result.link)) {
                                seen.add(result.link);
                                allResults.push(result);
                            }
                        }
                    }
                }
                allResults = allResults.slice(0, 5);
            }

            if (allResults.length > 0) {
                // Apply LLM-based relevance filtering when document context is available (Edit mode)
                const documentTopic = documentContext
                    ? (documentContext.headings.slice(0, 3).join(', ') || documentContext.fileName)
                    : '';
                const filteredResults = documentContext
                    ? await filterResultsWithAI(allResults, question, documentTopic, provider, model, requestId)
                    : allResults;

                if (filteredResults.length === 0) {
                    console.log('[useWebSearch] All results filtered as irrelevant');
                    setWebSearchPhase(null);
                    return { webSearchBlock: '', sources: [], optimizedQuery: optimizedQueries[0] };
                }

                const results = filteredResults.slice(0, 5);
                let webSearchBlock = formatWebSearchResults(results);

                // Cap web context to prevent token overflow
                if (webSearchBlock.length > MAX_WEB_CONTEXT_LENGTH) {
                    const capped = results.slice(0, 3);
                    webSearchBlock = formatWebSearchResults(capped);
                }

                const sources = results.map(r => ({ title: r.title, link: r.link }));

                setWebSearchPhase(null);
                return { webSearchBlock, sources, optimizedQuery: optimizedQueries[0] };
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
