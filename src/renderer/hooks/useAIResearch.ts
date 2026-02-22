import { useState, useCallback, useRef } from 'react';
import { useEditorDispatch, useEditorState } from '../contexts/EditorContext';
import type { AIProvider } from './useAIChat';

// Generate unique ID (same pattern as useAIDiffEdit)
const generateId = () => Math.random().toString(36).substring(2, 11);

export type ResearchPhase = 'inference' | 'researching' | 'deepening' | 'naming' | 'complete' | null;

export interface DeepeningProgress {
    current: number;
    total: number;
}

export interface InferenceResult {
    audience: string;
    fields: string[];
    focusAreas: string;
    deepDiveTopics: string[];
}

const DEFAULT_INFERENCE: InferenceResult = {
    audience: 'general practitioners and engineers',
    fields: ['technology', 'science'],
    focusAreas: 'broad overview with practical insights',
    deepDiveTopics: [],
};

// --- Step 1: Pre-Prompt Inference ---
const INFERENCE_PROMPT_TEMPLATE = `Analyze this research topic and respond with JSON only. No other text.

Topic: "{TOPIC}"
User Intent: "{USER_INTENT}"

{
  "audience": "<inferred target audience, e.g. 'mid-level software engineers building AI apps'>",
  "fields": ["<field1>", "<field2>", "<field3>"],
  "focusAreas": "<2-3 key angles to explore, comma separated, prioritize technical hooks and reactivity if relevant>",
  "deepDiveTopics": ["<list 4-6 technical concepts to deep dive, e.g. 'useEffect', 'useMemo', 'useCallback', 'React reconciliation', 'concurrent rendering', 'reactive programming model'>"]
}`;

function buildInferencePrompt(topic: string): string {
    return INFERENCE_PROMPT_TEMPLATE
        .replaceAll('{TOPIC}', topic)
        .replaceAll('{USER_INTENT}', topic);
}

function normalizeInference(parsed: Record<string, unknown>): InferenceResult | null {
    if (parsed.audience && Array.isArray(parsed.fields) && parsed.focusAreas) {
        return {
            audience: parsed.audience as string,
            fields: parsed.fields as string[],
            focusAreas: parsed.focusAreas as string,
            deepDiveTopics: Array.isArray(parsed.deepDiveTopics)
                ? (parsed.deepDiveTopics as string[])
                : [],
        };
    }
    return null;
}

function parseInferenceResponse(text: string): InferenceResult {
    // Try parsing JSON directly
    try {
        const result = normalizeInference(JSON.parse(text));
        if (result) return result;
    } catch { /* fall through */ }

    // Try extracting JSON from markdown code fences or surrounding text
    const jsonMatch = text.match(/\{[\s\S]*?"audience"[\s\S]*?"fields"[\s\S]*?"focusAreas"[\s\S]*?\}/);
    if (jsonMatch) {
        try {
            const result = normalizeInference(JSON.parse(jsonMatch[0]));
            if (result) return result;
        } catch { /* fall through */ }
    }

    return DEFAULT_INFERENCE;
}

// --- Step 2: Main Research Prompt ---
const RESEARCH_PROMPT_TEMPLATE = `You are an elite, multidisciplinary research strategist and synthesizer, with expertise across {FIELDS}. Your mission: Deliver the deepest, most balanced, and actionable research report on the topic: "{TOPIC}".

**Core Principles (Follow Strictly):**
- **Depth First**: Go beyond surface-level. Uncover historical roots, current realities, key players/innovators, data/evidence, debates, biases, blind spots, and forward-looking implications.
- **Technical Mastery**: For any engineering, coding, or implementation aspects, provide concrete, executable insights. Include architectures, code snippets (in relevant languages like Python, JavaScript, Rust), pseudocode, step-by-step guides, tools/libraries, real-world case studies, and validation methods. Explain "how to do it" with clarity for practitioners.
- **Truth-Seeking**: Synthesize from diverse, credible perspectives. Cross-verify claims. Highlight contradictions, uncertainties, and evolving consensus. Prioritize primary sources over summaries.
- **Strategic Value**: Tailor insights for {AUDIENCE}. Connect dots to risks, opportunities, and decisions.
- **Capability Optimization**: Assess your tools and knowledge (e.g., web search, page browsing, code execution, real-time feeds). Use them iteratively to gather fresh, specific data. If limited, simulate depth via reasoned extrapolation from known facts.

**Focus Areas**: {FOCUS_AREAS}
**Deep Dive Topics**: {DEEP_DIVE_TOPICS}

**Step-by-Step Research Protocol (Execute Internally Before Output):**
1. **Scope & Brainstorm**: Define 5-7 core angles (e.g., tech, policy, economics, engineering). Generate targeted queries for any search/browse tools.
2. **Gather Evidence**:
   - Run 4-6 broad-to-specific searches (e.g., "{TOPIC} 2024-2026 site:edu OR site:gov OR site:org OR site:github.com").
   - Dive into 6-10 key sources: Extract stats, quotes, methodologies, counterpoints, and technical artifacts (e.g., code repos, arXiv implementations).
   - Check real-time signals: Recent discussions, expert takes, breaking news, open-source updates.
   - **Technical Deep Dive**: Identify engineering patterns, code examples, and blueprints. Browse GitHub repos, papers, or docs for implementations. Use code tools to test/validate snippets if possible. **Prioritize deep analysis of {DEEP_DIVE_TOPICS} with internals, pitfalls, latest updates, and reactive behaviors.**
3. **Synthesize & Critique**: Map patterns, resolve conflicts, rate source reliability (e.g., peer-reviewed = high). Quantify confidence (High/Med/Low) for claims, especially technical ones.
4. **Forecast & Apply**: Project 1-5 year scenarios. Derive 4-6 actionable insights, including implementation roadmaps.

**Output Format (Markdown, Scannable, 1500-3500 Words):**
- **Executive Summary (250 words)**: 4-6 bullet takeaways + "Why this matters NOW for {AUDIENCE}".
- **Historical Evolution**: Timeline of milestones, paradigm shifts.
- **Current State**: Landscape, leaders, metrics, adoption stats.
- **Key Debates & Risks**: Pros/cons, stakeholder views, controversies.
- **Engineering & Implementation Guide**:
  - Core architectures and system designs (with diagrams described in text).
  - **Deep Dive Sections** (NEW): Dedicated subsections for {DEEP_DIVE_TOPICS} — provide internals, mechanics, lifecycle details, dependency management, async patterns, common pitfalls, and production-ready code examples for each.
  - Step-by-step "how-to" implementations, including code examples (e.g., full functions, setup scripts) with inline explanations.
  - Recommended tools, libraries, frameworks, and deployment strategies.
  - Common pitfalls, optimizations, and debugging tips.
  - Real-world case studies or reproducible examples.
- **Future Horizons**: Scenarios, wildcards, 2026-2030 projections.
- **Actionable Playbook**: Recommendations, experiments, watchlists, open questions.
- **Sources & Rigor**: Top 10-15 references (links where possible), methodology notes, confidence matrix, gaps/limitations.

Be objective yet engaging. If data is thin, admit it and hypothesize based on patterns. For technical sections, ensure code is production-ready and explain trade-offs. Start directly with the summary.`;

/**
 * Build the full research prompt with inferred (or default) metadata.
 * Designed to work with or without the inference step — pass DEFAULT_INFERENCE
 * to skip pre-inference entirely.
 */
export function buildResearchPrompt(
    topic: string,
    inference: InferenceResult = DEFAULT_INFERENCE
): string {
    const deepDiveStr = inference.deepDiveTopics.length > 0
        ? inference.deepDiveTopics.join(', ')
        : 'key technical concepts related to the topic';
    return RESEARCH_PROMPT_TEMPLATE
        .replaceAll('{TOPIC}', topic)
        .replaceAll('{AUDIENCE}', inference.audience)
        .replaceAll('{FIELDS}', inference.fields.join(', '))
        .replaceAll('{FOCUS_AREAS}', inference.focusAreas)
        .replaceAll('{DEEP_DIVE_TOPICS}', deepDiveStr);
}

// --- Step 3: Deepening Prompt ---
const DEEPENING_PROMPT_TEMPLATE = `You previously wrote a research report on "{TOPIC}". The report is good but needs more depth in specific technical areas.

Please write an **addendum** that provides an exhaustive deep dive into these specific topics: {BATCH_TOPICS}

For each topic, provide:
1. **Detailed technical explanation** with internals, mechanics, and how it works under the hood
2. **Production-ready code examples** with inline comments explaining each step
3. **Common pitfalls and edge cases** with solutions
4. **Best practices and anti-patterns** with before/after code comparisons
5. **2025-2026 updates** — latest changes, deprecations, or new approaches

Format as markdown that can be appended directly to the original report. Use ## headings for each topic. Target 800-1500 words.`;

const DEEPENING_BATCH_SIZE = 2;
const DEEPENING_MAX_BATCHES = 3;

function batchTopics(topics: string[]): string[][] {
    const batches: string[][] = [];
    for (let i = 0; i < topics.length && batches.length < DEEPENING_MAX_BATCHES; i += DEEPENING_BATCH_SIZE) {
        batches.push(topics.slice(i, i + DEEPENING_BATCH_SIZE));
    }
    return batches;
}

function buildDeepeningPrompt(topic: string, batchTopicsList: string[]): string {
    return DEEPENING_PROMPT_TEMPLATE
        .replaceAll('{TOPIC}', topic)
        .replaceAll('{BATCH_TOPICS}', batchTopicsList.join(', '));
}

// --- Step 4: Filename Inference ---
const FILENAME_PROMPT_TEMPLATE = `Generate a short, descriptive filename for a research report about: "{TOPIC}"

Rules:
- Return ONLY the filename, nothing else
- No file extension
- Max 50 characters
- Use Title Case with spaces (e.g. "React Hooks Deep Dive")
- Be specific and descriptive`;

function buildFilenamePrompt(topic: string): string {
    return FILENAME_PROMPT_TEMPLATE.replaceAll('{TOPIC}', topic);
}

function sanitizeFileName(raw: string): string {
    let name = raw.trim();
    // Remove surrounding quotes
    name = name.replace(/^["']|["']$/g, '');
    // Remove file extension if present
    name = name.replace(/\.\w+$/, '');
    // Remove invalid filename characters
    name = name.replace(/[/\\:*?"<>|]/g, '');
    // Collapse multiple spaces
    name = name.replace(/\s+/g, ' ').trim();
    // Truncate to 60 chars
    if (name.length > 60) {
        name = name.substring(0, 60).trim();
    }
    return name;
}

// --- Hook ---

async function callChatApi(
    provider: AIProvider,
    messages: { role: 'user' | 'assistant'; content: string }[],
    model: string,
    requestId: string,
) {
    if (provider === 'claude') {
        return window.electronAPI.claudeChatRequest(messages, model, requestId);
    }
    if (provider === 'xai') {
        return window.electronAPI.aiChatRequest(messages, model, requestId);
    }
    if (provider === 'gemini') {
        return window.electronAPI.geminiChatRequest(messages, model, requestId);
    }
    return window.electronAPI.openaiChatRequest(messages, model, requestId);
}

export function useAIResearch() {
    const dispatch = useEditorDispatch();
    const state = useEditorState();

    const [isResearchLoading, setIsResearchLoading] = useState(false);
    const [researchError, setResearchError] = useState<string | null>(null);
    const [researchPhase, setResearchPhase] = useState<ResearchPhase>(null);
    const [deepeningProgress, setDeepeningProgress] = useState<DeepeningProgress | null>(null);
    const [inferenceResult, setInferenceResult] = useState<InferenceResult | null>(null);
    const [researchComplete, setResearchComplete] = useState(false);
    const activeRequestIdRef = useRef<string | null>(null);

    const submitResearch = useCallback(async (
        topic: string,
        provider: AIProvider,
        model: string,
        requestId: string,
    ) => {
        if (!topic.trim()) {
            throw new Error('Please enter a research topic');
        }

        activeRequestIdRef.current = requestId;
        setIsResearchLoading(true);
        setResearchError(null);
        setDeepeningProgress(null);
        setInferenceResult(null);
        setResearchComplete(false);

        const startTime = Date.now();
        console.log('[Research] Starting research', { topic, provider, model, requestId });

        try {
            // Step 1: Pre-prompt inference
            setResearchPhase('inference');
            let inference: InferenceResult = DEFAULT_INFERENCE;

            const inferenceMessages = [{
                role: 'user' as const,
                content: buildInferencePrompt(topic),
            }];

            console.log('[Research] Phase: inference — calling API');
            const inferenceResponse = await callChatApi(
                provider, inferenceMessages, model, `${requestId}-inference`
            );

            if (activeRequestIdRef.current !== requestId) return;

            if (inferenceResponse.success && inferenceResponse.response) {
                inference = parseInferenceResponse(inferenceResponse.response);
                setInferenceResult(inference);
                console.log('[Research] Inference complete', {
                    elapsed: Date.now() - startTime,
                    inference,
                });
            } else {
                console.log('[Research] Inference failed, using defaults', {
                    elapsed: Date.now() - startTime,
                    error: inferenceResponse.error,
                });
            }
            // If inference fails, DEFAULT_INFERENCE is used — no error thrown

            // Step 2: Main research call
            setResearchPhase('researching');

            const researchPrompt = buildResearchPrompt(topic, inference);
            const researchMessages = [{
                role: 'user' as const,
                content: researchPrompt,
            }];

            console.log('[Research] Phase: researching — calling API');
            const researchResponse = await callChatApi(
                provider, researchMessages, model, `${requestId}-research`
            );

            if (activeRequestIdRef.current !== requestId) return;

            if (!researchResponse.success || !researchResponse.response) {
                throw new Error(researchResponse.error || 'Research request failed');
            }

            let finalContent = researchResponse.response;
            console.log('[Research] Main research complete', {
                elapsed: Date.now() - startTime,
                responseLength: finalContent.length,
            });

            // Step 3: Dynamic deepening calls
            const batches = batchTopics(inference.deepDiveTopics);

            if (batches.length > 0) {
                setResearchPhase('deepening');
                console.log('[Research] Phase: deepening', {
                    deepDiveTopics: inference.deepDiveTopics,
                    batchCount: batches.length,
                });

                const deepeningResults: string[] = [];

                for (let i = 0; i < batches.length; i++) {
                    if (activeRequestIdRef.current !== requestId) return;

                    setDeepeningProgress({ current: i + 1, total: batches.length });

                    const batchRequestId = `${requestId}-deepening-${i}`;
                    const deepeningPrompt = buildDeepeningPrompt(topic, batches[i]);
                    const deepeningMessages = [{
                        role: 'user' as const,
                        content: deepeningPrompt,
                    }];

                    console.log(`[Research] Deepening call ${i + 1}/${batches.length}`, {
                        topics: batches[i],
                        requestId: batchRequestId,
                    });

                    try {
                        const deepeningResponse = await callChatApi(
                            provider, deepeningMessages, model, batchRequestId
                        );

                        if (activeRequestIdRef.current !== requestId) return;

                        if (deepeningResponse.success && deepeningResponse.response) {
                            deepeningResults.push(deepeningResponse.response);
                            console.log(`[Research] Deepening ${i + 1}/${batches.length} complete`, {
                                elapsed: Date.now() - startTime,
                                responseLength: deepeningResponse.response.length,
                            });
                        } else {
                            console.error(`[Research] Deepening ${i + 1}/${batches.length} failed`, {
                                error: deepeningResponse.error,
                            });
                            // Graceful degradation — continue with remaining batches
                        }
                    } catch (deepErr) {
                        console.error(`[Research] Deepening ${i + 1}/${batches.length} error`, deepErr);
                        // Graceful degradation — continue with remaining batches
                    }
                }

                // Merge base report with deepening results
                if (deepeningResults.length > 0) {
                    finalContent = finalContent + '\n\n---\n\n' + deepeningResults.join('\n\n');
                }
            }

            console.log('[Research] Research complete', {
                totalElapsed: Date.now() - startTime,
                totalLength: finalContent.length,
                deepeningCalls: batches.length,
            });

            // Step 4: Infer a descriptive filename
            const topicSnippet = topic.length > 40
                ? topic.substring(0, 40).trim() + '...'
                : topic;
            let fileName = `Research - ${topicSnippet}.md`;

            setResearchPhase('naming');
            console.log('[Research] Phase: naming — calling API');

            try {
                if (activeRequestIdRef.current !== requestId) return;

                const namingMessages = [{
                    role: 'user' as const,
                    content: buildFilenamePrompt(topic),
                }];

                const namingResponse = await callChatApi(
                    provider, namingMessages, model, `${requestId}-naming`
                );

                if (activeRequestIdRef.current !== requestId) return;

                if (namingResponse.success && namingResponse.response) {
                    const sanitized = sanitizeFileName(namingResponse.response);
                    if (sanitized.length > 0) {
                        fileName = `${sanitized}.md`;
                    }
                    console.log('[Research] Naming complete', {
                        elapsed: Date.now() - startTime,
                        rawName: namingResponse.response,
                        sanitized,
                        fileName,
                    });
                } else {
                    console.log('[Research] Naming failed, using fallback', {
                        error: namingResponse.error,
                    });
                }
            } catch (namingErr) {
                console.error('[Research] Naming error, using fallback', namingErr);
            }

            // Step 5: Create a new file tab with the merged output
            const fileId = generateId();

            dispatch({
                type: 'OPEN_FILE',
                payload: {
                    id: fileId,
                    path: null,
                    name: fileName,
                    content: finalContent,
                    lineEnding: state.config.defaultLineEnding,
                    viewMode: 'preview' as const,
                    fileType: 'markdown' as const,
                },
            });

            // Mark research as complete — stepper stays visible
            setResearchPhase('complete');
            setResearchComplete(true);
        } catch (err) {
            if (activeRequestIdRef.current !== requestId) return;
            const message = err instanceof Error ? err.message : 'Research request failed';
            console.error('[Research] Error', { phase: researchPhase, elapsed: Date.now() - startTime, error: message });
            setResearchError(message);
            // Clear stepper state on error (don't persist)
            setResearchPhase(null);
            setDeepeningProgress(null);
            setInferenceResult(null);
            setResearchComplete(false);
            throw err;
        } finally {
            if (activeRequestIdRef.current === requestId) {
                activeRequestIdRef.current = null;
                setIsResearchLoading(false);
            }
        }
    }, [dispatch, state.config.defaultLineEnding]);

    const dismissResearchProgress = useCallback(() => {
        setResearchPhase(null);
        setDeepeningProgress(null);
        setInferenceResult(null);
        setResearchComplete(false);
    }, []);

    const cancelResearch = useCallback(async () => {
        const requestId = activeRequestIdRef.current;
        activeRequestIdRef.current = null;
        setIsResearchLoading(false);
        setResearchPhase(null);
        setDeepeningProgress(null);
        setInferenceResult(null);
        setResearchComplete(false);
        setResearchError('Research request canceled');

        if (requestId) {
            console.log('[Research] Canceling', { requestId });
            // Cancel all possible in-flight requests
            try {
                await window.electronAPI.cancelAIChatRequest(`${requestId}-inference`);
            } catch { /* ignore */ }
            try {
                await window.electronAPI.cancelAIChatRequest(`${requestId}-research`);
            } catch { /* ignore */ }
            // Cancel deepening requests (up to max batches)
            for (let i = 0; i < DEEPENING_MAX_BATCHES; i++) {
                try {
                    await window.electronAPI.cancelAIChatRequest(`${requestId}-deepening-${i}`);
                } catch { /* ignore */ }
            }
            try {
                await window.electronAPI.cancelAIChatRequest(`${requestId}-naming`);
            } catch { /* ignore */ }
        }
    }, []);

    return {
        submitResearch,
        cancelResearch,
        dismissResearchProgress,
        isResearchLoading,
        researchError,
        researchPhase,
        deepeningProgress,
        inferenceResult,
        researchComplete,
    };
}
