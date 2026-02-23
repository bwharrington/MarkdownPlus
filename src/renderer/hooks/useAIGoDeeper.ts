import { useState, useCallback, useRef } from 'react';
import { useEditorDispatch, useEditorState } from '../contexts/EditorContext';
import type { AIProvider } from './useAIChat';
import { closeUnclosedFences } from '../utils/sanitizeMarkdown';
import { callWithContinuation } from '../utils/callWithContinuation';

const generateId = () => Math.random().toString(36).substring(2, 11);

// --- Types ---

export type GoDeepPhase = 'analyzing' | 'topic_selection' | 'expanding' | 'integrating' | 'finalizing' | 'complete' | null;

export interface GoDeepProgress {
    current: number;
    total: number;
}

export type GoDeepDepthLevel = 'beginner' | 'practitioner' | 'expert';

export interface GoDeepAnalysis {
    newFocusAreas: string;
    newDeepDiveTopics: string[];
    suggestedDepthLevel: GoDeepDepthLevel;
    changelogIdeas: string[];
}

const DEFAULT_ANALYSIS: GoDeepAnalysis = {
    newFocusAreas: 'latest developments, production edge cases, alternative approaches',
    newDeepDiveTopics: [],
    suggestedDepthLevel: 'practitioner',
    changelogIdeas: [],
};

// Intermediate state held between submitAnalysis and submitExpansion
interface PendingContext {
    fileId: string;
    originalContent: string;
    topic: string;
    provider: AIProvider;
    model: string;
    requestId: string;
    startTime: number;
    nextVersion: number;
    versionLabel: string;
    analysis: GoDeepAnalysis;
    depthLevel: GoDeepDepthLevel;
}

// --- Phase D1: Report Analysis ---

const ANALYSIS_PROMPT_TEMPLATE = `Analyze the following completed research report on the topic "{TOPIC}" and determine the highest-value ways to go deeper.

Report content:
{EXISTING_FULL_REPORT}

User focus (if any): the entire report

**Target audience depth level: {DEPTH_LEVEL_LABEL}**
{DEPTH_INSTRUCTIONS}

When suggesting topics and focus areas, tailor them to the depth level above. For example:
- Beginner: suggest foundational concepts, definitions, and simple how-to topics
- Practitioner: suggest practical patterns, real-world usage, and working code topics
- Expert: suggest internals, edge cases, performance trade-offs, and production-scale topics

Respond with JSON only. No other text.

{
  "newFocusAreas": "<2-4 key angles to expand, comma-separated, tailored to the depth level>",
  "newDeepDiveTopics": ["<5-8 high-value topics suited to the depth level>"],
  "suggestedDepthLevel": "{DEPTH_LEVEL_VALUE}",
  "freshResearchRequired": true | false,
  "changelogIdeas": ["<4-6 short bullets describing what will be added>"]
}`;

function buildAnalysisPrompt(topic: string, report: string, depthLevel: GoDeepDepthLevel): string {
    const depthLabelMap: Record<GoDeepDepthLevel, string> = {
        beginner: 'Beginner',
        practitioner: 'Practitioner',
        expert: 'Expert',
    };
    return ANALYSIS_PROMPT_TEMPLATE
        .replaceAll('{TOPIC}', topic)
        .replaceAll('{EXISTING_FULL_REPORT}', report)
        .replaceAll('{DEPTH_LEVEL_LABEL}', depthLabelMap[depthLevel])
        .replaceAll('{DEPTH_INSTRUCTIONS}', DEPTH_INSTRUCTIONS[depthLevel])
        .replaceAll('{DEPTH_LEVEL_VALUE}', depthLevel);
}

function normalizeAnalysis(parsed: Record<string, unknown>): GoDeepAnalysis | null {
    if (parsed.newFocusAreas && Array.isArray(parsed.newDeepDiveTopics)) {
        return {
            newFocusAreas: parsed.newFocusAreas as string,
            newDeepDiveTopics: parsed.newDeepDiveTopics as string[],
            suggestedDepthLevel: parsed.suggestedDepthLevel === 'beginner'
                ? 'beginner'
                : parsed.suggestedDepthLevel === 'practitioner'
                    ? 'practitioner'
                    : 'expert',
            changelogIdeas: Array.isArray(parsed.changelogIdeas)
                ? (parsed.changelogIdeas as string[])
                : [],
        };
    }
    return null;
}

function parseAnalysisResponse(text: string): GoDeepAnalysis {
    // Try parsing JSON directly
    try {
        const result = normalizeAnalysis(JSON.parse(text));
        if (result) return result;
    } catch { /* fall through */ }

    // Try extracting JSON from markdown code fences
    const fenceMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (fenceMatch) {
        try {
            const result = normalizeAnalysis(JSON.parse(fenceMatch[1]));
            if (result) return result;
        } catch { /* fall through */ }
    }

    // Try extracting JSON from surrounding text
    const jsonMatch = text.match(/\{[\s\S]*?"newFocusAreas"[\s\S]*?"newDeepDiveTopics"[\s\S]*?\}/);
    if (jsonMatch) {
        try {
            const result = normalizeAnalysis(JSON.parse(jsonMatch[0]));
            if (result) return result;
        } catch { /* fall through */ }
    }

    return DEFAULT_ANALYSIS;
}

// --- Phase D2: Deep Dive Expansion ---

const DEPTH_INSTRUCTIONS: Record<string, string> = {
    beginner: `Write for someone new to this topic. Prioritize clear explanations over jargon. Define technical terms when introduced. Use simple, well-commented code examples. Focus on "what it is" and "why it matters" before "how it works". Avoid assuming prior knowledge.`,
    practitioner: `Write for someone who actively works with this technology. Focus on practical patterns, real-world usage, and working code. Include common pitfalls and how to avoid them. Assume familiarity with fundamentals but explain non-obvious behaviors.`,
    expert: `Write for a deep technical expert. Prioritize internals, implementation trade-offs, edge cases, and production-scale concerns. Include advanced code patterns, performance considerations, and architectural decisions. Skip introductory explanations.`,
};

const EXPANSION_PROMPT_TEMPLATE = `You previously generated this research report:

{TOPIC}

Here is the full original report for context:
{ORIGINAL_REPORT}

Create a rich, standalone addendum that significantly deepens the following topics: {BATCH_TOPICS}

**Audience depth level: {DEPTH_LEVEL_LABEL}**
{DEPTH_INSTRUCTIONS}

For each topic deliver:
- Latest 2025–2026 developments and changes
- Internals, mechanics, and under-the-hood details (scaled to depth level)
- Code examples with inline explanations (complexity scaled to depth level)
- Quantitative insights, benchmarks, or comparisons where relevant
- Alternative implementations and trade-offs

Output ONLY clean Markdown that can be appended directly. Start with:

## Deep Dive Addendum — {CURRENT_DATE}

Use ## subheadings for each topic. Target 600–1200 words per batch.`;

const EXPANSION_BATCH_SIZE = 3;
const EXPANSION_MAX_BATCHES = 4;

function batchTopics(topics: string[]): string[][] {
    const batches: string[][] = [];
    for (let i = 0; i < topics.length && batches.length < EXPANSION_MAX_BATCHES; i += EXPANSION_BATCH_SIZE) {
        batches.push(topics.slice(i, i + EXPANSION_BATCH_SIZE));
    }
    return batches;
}

function buildExpansionPrompt(
    topic: string,
    originalReport: string,
    batchTopicsList: string[],
    depthLevel: GoDeepDepthLevel,
): string {
    const currentDate = new Date().toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
    });
    const depthLabelMap: Record<GoDeepDepthLevel, string> = {
        beginner: 'Beginner',
        practitioner: 'Practitioner',
        expert: 'Expert',
    };
    return EXPANSION_PROMPT_TEMPLATE
        .replaceAll('{TOPIC}', topic)
        .replaceAll('{ORIGINAL_REPORT}', originalReport)
        .replaceAll('{BATCH_TOPICS}', batchTopicsList.join(', '))
        .replaceAll('{CURRENT_DATE}', currentDate)
        .replaceAll('{DEPTH_LEVEL_LABEL}', depthLabelMap[depthLevel])
        .replaceAll('{DEPTH_INSTRUCTIONS}', DEPTH_INSTRUCTIONS[depthLevel]);
}

// --- Phase D3: Intelligent Integration ---

const CHANGELOG_PROMPT_TEMPLATE = `You are summarizing changes made to a research report during a "Go Deeper" pass.

Original report topic: {TOPIC}
Audience depth level: {DEPTH_LEVEL_LABEL}

Here are the new deep-dive addendums that were generated:
{ALL_ADDENDUMS_CONCATENATED}

Write a concise changelog as a Markdown bullet list summarizing what was added. Each bullet should be one short sentence describing a specific addition or enhancement.

Rules:
- Return ONLY the bullet list (lines starting with "- ")
- 4-8 bullets maximum
- Be specific about topics covered, not vague
- Do not include any headings, preamble, or closing text`;

function buildChangelogPrompt(topic: string, addendums: string, depthLevel: GoDeepDepthLevel): string {
    const depthLabelMap: Record<GoDeepDepthLevel, string> = {
        beginner: 'Beginner',
        practitioner: 'Practitioner',
        expert: 'Expert',
    };
    return CHANGELOG_PROMPT_TEMPLATE
        .replaceAll('{TOPIC}', topic)
        .replaceAll('{ALL_ADDENDUMS_CONCATENATED}', addendums)
        .replaceAll('{DEPTH_LEVEL_LABEL}', depthLabelMap[depthLevel]);
}

function buildFinalDocument(
    originalReport: string,
    addendums: string,
    changelog: string,
    versionLabel: string,
): string {
    const changelogSection = `## Changelog (Deepened ${versionLabel})\n\n${changelog}`;
    return `${originalReport}\n\n---\n\n${addendums}\n\n---\n\n${changelogSection}`;
}

// --- Phase D4: Filename Generation ---

const FILENAME_PROMPT_TEMPLATE = `Generate a short, descriptive Title Case filename (no extension, max 60 characters) for version {VERSION_NUMBER} of the research report about "{ORIGINAL_TOPIC}" that clearly reflects it has been significantly deepened.

Return ONLY the filename.`;

function buildFilenamePrompt(topic: string, versionNumber: number): string {
    return FILENAME_PROMPT_TEMPLATE
        .replaceAll('{ORIGINAL_TOPIC}', topic)
        .replaceAll('{VERSION_NUMBER}', String(versionNumber));
}

function sanitizeFileName(raw: string): string {
    let name = raw.trim();
    name = name.replace(/^["']|["']$/g, '');
    name = name.replace(/\.\w+$/, '');
    name = name.replace(/[/\\:*?"<>|]/g, '');
    name = name.replace(/\s+/g, ' ').trim();
    if (name.length > 60) {
        name = name.substring(0, 60).trim();
    }
    return name;
}

// --- Version helpers ---

function parseVersion(fileName: string): { baseName: string; version: number } {
    const base = fileName.replace(/\.md$/i, '');
    const match = base.match(/^(.*?)\s+v(\d+)$/i);
    if (match) {
        return { baseName: match[1], version: parseInt(match[2], 10) };
    }
    return { baseName: base, version: 1 };
}

// --- API helper ---

async function callChatApi(
    provider: AIProvider,
    messages: { role: 'user' | 'assistant'; content: string }[],
    model: string,
    requestId: string,
    maxTokens?: number,
) {
    if (provider === 'claude') {
        return window.electronAPI.claudeChatRequest(messages, model, requestId, maxTokens);
    }
    if (provider === 'xai') {
        return window.electronAPI.aiChatRequest(messages, model, requestId, maxTokens);
    }
    if (provider === 'gemini') {
        return window.electronAPI.geminiChatRequest(messages, model, requestId, maxTokens);
    }
    return window.electronAPI.openaiChatRequest(messages, model, requestId, maxTokens);
}

const EXPANSION_MAX_TOKENS = 16384;

// --- Hook ---

export function useAIGoDeeper() {
    const dispatch = useEditorDispatch();
    const state = useEditorState();

    const [isGoDeepLoading, setIsGoDeepLoading] = useState(false);
    const [goDeepError, setGoDeepError] = useState<string | null>(null);
    const [goDeepPhase, setGoDeepPhase] = useState<GoDeepPhase>(null);
    const [goDeepProgress, setGoDeepProgress] = useState<GoDeepProgress | null>(null);
    const [goDeepAnalysis, setGoDeepAnalysis] = useState<GoDeepAnalysis | null>(null);
    const [goDeepComplete, setGoDeepComplete] = useState(false);
    const activeRequestIdRef = useRef<string | null>(null);

    // Holds state between submitAnalysis and submitExpansion
    const pendingContextRef = useRef<PendingContext | null>(null);

    // --- Phase D1: Analysis only ---
    const submitAnalysis = useCallback(async (
        fileId: string,
        originalContent: string,
        topic: string,
        provider: AIProvider,
        model: string,
        requestId: string,
        depthLevel: GoDeepDepthLevel = 'practitioner',
    ) => {
        if (!originalContent.trim()) {
            throw new Error('No report content to deepen');
        }

        activeRequestIdRef.current = requestId;
        pendingContextRef.current = null;
        setIsGoDeepLoading(true);
        setGoDeepError(null);
        setGoDeepProgress(null);
        setGoDeepAnalysis(null);
        setGoDeepComplete(false);

        const startTime = Date.now();
        const { version: currentVersion } = parseVersion(
            state.openFiles.find(f => f.id === fileId)?.name ?? topic
        );
        const nextVersion = currentVersion + 1;
        const versionLabel = `v${nextVersion}`;

        console.log('[GoDeeper] Starting analysis', { topic, provider, model, requestId, currentVersion, nextVersion, depthLevel });

        try {
            // Phase D1: Report Analysis
            setGoDeepPhase('analyzing');
            let analysis: GoDeepAnalysis = DEFAULT_ANALYSIS;

            const analysisMessages = [{
                role: 'user' as const,
                content: buildAnalysisPrompt(topic, originalContent, depthLevel),
            }];

            console.log('[GoDeeper] Phase: analyzing — calling API');
            const analysisResponse = await callChatApi(
                provider, analysisMessages, model, `${requestId}-goDeep-analysis`
            );

            if (activeRequestIdRef.current !== requestId) return;

            if (analysisResponse.success && analysisResponse.response) {
                analysis = parseAnalysisResponse(analysisResponse.response);
                setGoDeepAnalysis(analysis);
                console.log('[GoDeeper] Analysis complete', {
                    elapsed: Date.now() - startTime,
                    analysis,
                });
            } else {
                console.log('[GoDeeper] Analysis failed, using defaults', {
                    elapsed: Date.now() - startTime,
                    error: analysisResponse.error,
                });
            }

            // Pause here for topic selection — store context for submitExpansion
            pendingContextRef.current = {
                fileId,
                originalContent,
                topic,
                provider,
                model,
                requestId,
                startTime,
                nextVersion,
                versionLabel,
                analysis,
                depthLevel,
            };

            // Switch to topic_selection phase — keep isGoDeepLoading true so border animation stays
            setGoDeepPhase('topic_selection');
            console.log('[GoDeeper] Waiting for topic selection');

        } catch (err) {
            if (activeRequestIdRef.current !== requestId) return;
            const message = err instanceof Error ? err.message : 'Go Deeper analysis failed';
            console.error('[GoDeeper] Analysis error', { error: message });
            setGoDeepError(message);
            setGoDeepPhase(null);
            setGoDeepProgress(null);
            setGoDeepAnalysis(null);
            setGoDeepComplete(false);
            activeRequestIdRef.current = null;
            setIsGoDeepLoading(false);
            throw err;
        }
        // Note: we intentionally do NOT call setIsGoDeepLoading(false) here —
        // we stay in loading state through the topic_selection pause.
    }, [state.openFiles]);

    // --- Phases D2-D4: Expansion with user-selected topics ---
    const submitExpansion = useCallback(async (selectedTopics: string[]) => {
        const ctx = pendingContextRef.current;
        if (!ctx) {
            console.error('[GoDeeper] submitExpansion called with no pending context');
            return;
        }

        const { fileId, originalContent, topic, provider, model, requestId, startTime, nextVersion, versionLabel, analysis, depthLevel } = ctx;
        pendingContextRef.current = null;

        if (activeRequestIdRef.current !== requestId) return;

        console.log('[GoDeeper] Starting expansion with selected topics', { selectedTopics, depthLevel, requestId });

        try {
            // Phase D2: Deep Dive Expansion
            const batches = batchTopics(selectedTopics);
            const expansionResults: string[] = [];

            if (batches.length > 0) {
                setGoDeepPhase('expanding');
                console.log('[GoDeeper] Phase: expanding', {
                    topics: selectedTopics,
                    batchCount: batches.length,
                });

                for (let i = 0; i < batches.length; i++) {
                    if (activeRequestIdRef.current !== requestId) return;

                    setGoDeepProgress({ current: i + 1, total: batches.length });

                    const batchRequestId = `${requestId}-goDeep-expand-${i}`;
                    const expansionPrompt = buildExpansionPrompt(topic, originalContent, batches[i], depthLevel);
                    const expansionMessages = [{
                        role: 'user' as const,
                        content: expansionPrompt,
                    }];

                    console.log(`[GoDeeper] Expansion batch ${i + 1}/${batches.length}`, {
                        topics: batches[i],
                        requestId: batchRequestId,
                    });

                    try {
                        const expansionResult = await callWithContinuation(
                            callChatApi, provider, expansionMessages, model,
                            batchRequestId, `[GoDeeper] Expansion ${i + 1}/${batches.length}`, EXPANSION_MAX_TOKENS
                        );

                        if (activeRequestIdRef.current !== requestId) return;

                        expansionResults.push(closeUnclosedFences(expansionResult.content));
                        console.log(`[GoDeeper] Expansion ${i + 1}/${batches.length} complete`, {
                            elapsed: Date.now() - startTime,
                            responseLength: expansionResult.content.length,
                            continuations: expansionResult.continuations,
                        });
                    } catch (expandErr) {
                        console.error(`[GoDeeper] Expansion ${i + 1}/${batches.length} error`, expandErr);
                    }
                }
            }

            // Phase D3: Integration (changelog generation + structural merge)
            setGoDeepPhase('integrating');
            let finalContent: string;

            if (expansionResults.length > 0) {
                const addendums = expansionResults.join('\n\n');

                // Ask AI to generate only a concise changelog (small output, reliable)
                let changelog = analysis.changelogIdeas.length > 0
                    ? analysis.changelogIdeas.map(idea => `- ${idea}`).join('\n')
                    : '';

                const changelogMessages = [{
                    role: 'user' as const,
                    content: buildChangelogPrompt(topic, addendums, depthLevel),
                }];

                console.log('[GoDeeper] Phase: integrating — generating changelog');
                try {
                    const changelogResponse = await callChatApi(
                        provider, changelogMessages, model, `${requestId}-goDeep-integrate`
                    );

                    if (activeRequestIdRef.current !== requestId) return;

                    if (changelogResponse.success && changelogResponse.response) {
                        changelog = changelogResponse.response;
                        console.log('[GoDeeper] Changelog generated', {
                            elapsed: Date.now() - startTime,
                            responseLength: changelog.length,
                        });
                    } else {
                        console.error('[GoDeeper] Changelog generation failed, using analysis fallback', {
                            error: changelogResponse.error,
                        });
                    }
                } catch (changelogErr) {
                    console.error('[GoDeeper] Changelog error, using analysis fallback', changelogErr);
                }

                // Structurally merge: original + addendums + changelog
                finalContent = buildFinalDocument(originalContent, addendums, changelog, versionLabel);
                console.log('[GoDeeper] Integration complete (structural merge)', {
                    elapsed: Date.now() - startTime,
                    originalLength: originalContent.length,
                    addendumsLength: addendums.length,
                    finalLength: finalContent.length,
                });
            } else {
                // No expansion results — just pass through with a changelog note
                finalContent = originalContent + `\n\n---\n\n## Changelog (Deepened ${versionLabel})\n\n- Report re-analyzed; no additional expansion topics identified.`;
                console.log('[GoDeeper] No expansion results, adding changelog header only');
            }

            // Phase D4: Filename & Versioning
            setGoDeepPhase('finalizing');

            const currentFile = state.openFiles.find(f => f.id === fileId);
            const currentName = currentFile?.name ?? `${topic}.md`;
            const { baseName, version: currentVersion } = parseVersion(currentName);
            let fileName = `${baseName} ${versionLabel}.md`;

            console.log('[GoDeeper] Phase: finalizing — calling API');

            try {
                if (activeRequestIdRef.current !== requestId) return;

                const namingMessages = [{
                    role: 'user' as const,
                    content: buildFilenamePrompt(topic, nextVersion),
                }];

                const namingResponse = await callChatApi(
                    provider, namingMessages, model, `${requestId}-goDeep-naming`
                );

                if (activeRequestIdRef.current !== requestId) return;

                if (namingResponse.success && namingResponse.response) {
                    const sanitized = sanitizeFileName(namingResponse.response);
                    if (sanitized.length > 0) {
                        // Ensure version is in the filename
                        const { version: inferredVersion } = parseVersion(sanitized);
                        if (inferredVersion <= currentVersion) {
                            fileName = `${sanitized} ${versionLabel}.md`;
                        } else {
                            fileName = `${sanitized}.md`;
                        }
                    }
                    console.log('[GoDeeper] Naming complete', {
                        elapsed: Date.now() - startTime,
                        rawName: namingResponse.response,
                        sanitized,
                        fileName,
                    });
                } else {
                    console.log('[GoDeeper] Naming failed, using fallback', {
                        error: namingResponse.error,
                        fileName,
                    });
                }
            } catch (namingErr) {
                console.error('[GoDeeper] Naming error, using fallback', namingErr);
            }

            // Update the file in-place
            dispatch({
                type: 'UPDATE_FILE_CONTENT',
                payload: {
                    id: fileId,
                    content: finalContent,
                    lineEnding: state.config.defaultLineEnding,
                },
            });

            dispatch({
                type: 'UPDATE_FILE_NAME',
                payload: {
                    id: fileId,
                    name: fileName,
                },
            });

            dispatch({
                type: 'SELECT_TAB',
                payload: { id: fileId },
            });

            dispatch({
                type: 'SHOW_NOTIFICATION',
                payload: {
                    severity: 'success',
                    message: `Go Deeper complete — ${fileName}. Remember to save your file (Ctrl+S).`,
                    variant: 'go-deeper',
                },
            });

            setGoDeepPhase('complete');
            setGoDeepComplete(true);

            console.log('[GoDeeper] Complete', {
                totalElapsed: Date.now() - startTime,
                finalLength: finalContent.length,
                fileName,
                version: nextVersion,
            });
        } catch (err) {
            if (activeRequestIdRef.current !== requestId) return;
            const message = err instanceof Error ? err.message : 'Go Deeper expansion failed';
            console.error('[GoDeeper] Expansion error', { error: message });
            setGoDeepError(message);
            setGoDeepPhase(null);
            setGoDeepProgress(null);
            setGoDeepAnalysis(null);
            setGoDeepComplete(false);
            throw err;
        } finally {
            if (activeRequestIdRef.current === requestId) {
                activeRequestIdRef.current = null;
                setIsGoDeepLoading(false);
            }
        }
    }, [dispatch, state.config.defaultLineEnding, state.openFiles]);

    const dismissGoDeepProgress = useCallback(() => {
        pendingContextRef.current = null;
        setGoDeepPhase(null);
        setGoDeepProgress(null);
        setGoDeepAnalysis(null);
        setGoDeepComplete(false);
    }, []);

    const cancelGoDeeper = useCallback(async () => {
        const requestId = activeRequestIdRef.current;
        activeRequestIdRef.current = null;
        pendingContextRef.current = null;
        setIsGoDeepLoading(false);
        setGoDeepPhase(null);
        setGoDeepProgress(null);
        setGoDeepAnalysis(null);
        setGoDeepComplete(false);
        setGoDeepError('Go Deeper request canceled');

        if (requestId) {
            console.log('[GoDeeper] Canceling', { requestId });
            try {
                await window.electronAPI.cancelAIChatRequest(`${requestId}-goDeep-analysis`);
            } catch { /* ignore */ }
            for (let i = 0; i < EXPANSION_MAX_BATCHES; i++) {
                for (const suffix of ['', '-cont-1', '-cont-2']) {
                    try {
                        await window.electronAPI.cancelAIChatRequest(`${requestId}-goDeep-expand-${i}${suffix}`);
                    } catch { /* ignore */ }
                }
            }
            try {
                await window.electronAPI.cancelAIChatRequest(`${requestId}-goDeep-integrate`);
            } catch { /* ignore */ }
            try {
                await window.electronAPI.cancelAIChatRequest(`${requestId}-goDeep-naming`);
            } catch { /* ignore */ }
        }
    }, []);

    return {
        submitAnalysis,
        submitExpansion,
        cancelGoDeeper,
        dismissGoDeepProgress,
        isGoDeepLoading,
        goDeepError,
        goDeepPhase,
        goDeepProgress,
        goDeepAnalysis,
        goDeepComplete,
    };
}
