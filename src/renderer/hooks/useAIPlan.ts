import { useState, useCallback, useRef } from 'react';
import { useEditorDispatch, useEditorState } from '../contexts/EditorContext';
import type { AIProvider } from './useAIChat';
import { callWithContinuation } from '../utils/callWithContinuation';
import type { AttachedFile } from '../components/FileAttachmentsList';
import type { IFile } from '../types';

const generateId = () => Math.random().toString(36).substring(2, 11);

export type PlanPhase =
    | 'scoping'     // Step 1: Analyze request → JSON blueprint
    | 'researching' // Step 2: Web search via Serper (optional)
    | 'planning'    // Step 3: Generate the full plan document
    | 'naming'      // Step 4: Generate filename
    | 'complete'
    | null;

// --- Blueprint types ---
interface PlanBlueprint {
    goalSummary: string;
    constraints: string[];
    workStreams: string[];
    searchQueries: string[];
}

const DEFAULT_BLUEPRINT: PlanBlueprint = {
    goalSummary: 'Build and execute the described project',
    constraints: [],
    workStreams: ['Planning', 'Implementation', 'Testing', 'Deployment'],
    searchQueries: [],
};

// --- Step 1: Scoping Prompt ---
const SCOPING_PROMPT_TEMPLATE = `Analyze the following project/task request and return a JSON planning blueprint only. No other text.

Request: "{REQUEST}"

{FILE_CONTEXT}

Return this JSON structure:
{
  "goalSummary": "<1-2 sentence distillation of what the user wants to accomplish>",
  "constraints": ["<inferred constraint 1>", "<inferred constraint 2>"],
  "workStreams": ["<major area of work 1>", "<area 2>", "<area 3>"],
  "searchQueries": ["<web search query 1>", "<web search query 2>"]
}

Rules:
- goalSummary: concise but complete
- constraints: infer from context (tech stack, scope, timeline hints). Empty array if none obvious.
- workStreams: 3-6 high-level categories of work needed
- searchQueries: 2-4 specific Google search queries to gather relevant real-world context (tools, best practices, pricing, docs). Empty array if no web context would help.`;

function buildScopingPrompt(request: string, fileContext: string): string {
    const contextSection = fileContext.trim()
        ? `Context from attached files:\n${fileContext.trim()}`
        : '';
    return SCOPING_PROMPT_TEMPLATE
        .replace('{REQUEST}', request)
        .replace('{FILE_CONTEXT}', contextSection);
}

function parseBlueprintResponse(text: string): PlanBlueprint {
    // Strategy 1: pure JSON
    try {
        const parsed = JSON.parse(text) as Partial<PlanBlueprint>;
        if (parsed.goalSummary && parsed.workStreams) {
            return {
                goalSummary: parsed.goalSummary,
                constraints: Array.isArray(parsed.constraints) ? parsed.constraints : [],
                workStreams: Array.isArray(parsed.workStreams) ? parsed.workStreams : DEFAULT_BLUEPRINT.workStreams,
                searchQueries: Array.isArray(parsed.searchQueries) ? parsed.searchQueries : [],
            };
        }
    } catch { /* fall through */ }

    // Strategy 2: find JSON block
    const jsonMatch = text.match(/\{[\s\S]*?"goalSummary"[\s\S]*?"workStreams"[\s\S]*?\}/);
    if (jsonMatch) {
        try {
            const parsed = JSON.parse(jsonMatch[0]) as Partial<PlanBlueprint>;
            if (parsed.goalSummary && parsed.workStreams) {
                return {
                    goalSummary: parsed.goalSummary,
                    constraints: Array.isArray(parsed.constraints) ? parsed.constraints : [],
                    workStreams: Array.isArray(parsed.workStreams) ? parsed.workStreams : DEFAULT_BLUEPRINT.workStreams,
                    searchQueries: Array.isArray(parsed.searchQueries) ? parsed.searchQueries : [],
                };
            }
        } catch { /* fall through */ }
    }

    return DEFAULT_BLUEPRINT;
}

// --- Step 3: Plan Generation Prompt ---
const PLANNING_PROMPT_TEMPLATE = `You are creating a comprehensive, actionable project plan.

**Request:** {REQUEST}

**Goal Summary:** {GOAL_SUMMARY}

**Key Constraints:** {CONSTRAINTS}

**Work Streams:** {WORK_STREAMS}

{WEB_RESEARCH_SECTION}

{FILE_CONTEXT_SECTION}

---

Write a detailed, structured project plan in Markdown using the sections below. Be specific, practical, and actionable.

## Objective
What will be accomplished and why it matters.

## Scope & Constraints
Boundaries, limitations, and non-goals. Include any technical, time, or resource constraints identified.

## Architecture / Approach
High-level strategy and key technical decisions. How will this be built? What technologies, patterns, or frameworks apply?

## Work Breakdown

For each work stream, provide a prioritized task list with brief descriptions and rough effort estimates (e.g., Small/Medium/Large or hours).

{WORK_STREAM_SECTIONS}

## Dependencies & Critical Path
Tasks that block other work, and the sequence that minimizes bottlenecks.

## Risk Assessment
| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|-----------|
| <risk 1> | High/Med/Low | High/Med/Low | <mitigation> |

## Resources & References
{RESOURCES_SECTION}

## Next Steps
The 3-5 immediate actions to start execution today.

---
*Generated by Plan Mode*`;

function buildPlanningPrompt(
    request: string,
    blueprint: PlanBlueprint,
    webResearchContext: string,
    fileContext: string,
): string {
    const constraintsText = blueprint.constraints.length > 0
        ? blueprint.constraints.join('; ')
        : 'None identified';

    const workStreamSections = blueprint.workStreams
        .map(ws => `### ${ws}\n- [ ] \n- [ ] \n- [ ] `)
        .join('\n\n');

    const webResearchSection = webResearchContext.trim()
        ? `**Web Research Context:**\n${webResearchContext.trim()}`
        : '';

    const fileContextSection = fileContext.trim()
        ? `**Context from attached files:**\n${fileContext.trim()}`
        : '';

    const resourcesSection = webResearchContext.trim()
        ? 'Include relevant links from the web research above, plus any recommended tools and documentation.'
        : 'List recommended tools, documentation links, and any other helpful references.';

    return PLANNING_PROMPT_TEMPLATE
        .replace('{REQUEST}', request)
        .replace('{GOAL_SUMMARY}', blueprint.goalSummary)
        .replace('{CONSTRAINTS}', constraintsText)
        .replace('{WORK_STREAMS}', blueprint.workStreams.join(', '))
        .replace('{WEB_RESEARCH_SECTION}', webResearchSection)
        .replace('{FILE_CONTEXT_SECTION}', fileContextSection)
        .replace('{WORK_STREAM_SECTIONS}', workStreamSections)
        .replace('{RESOURCES_SECTION}', resourcesSection);
}

// --- Step 4: Naming Prompt ---
const NAMING_PROMPT_TEMPLATE = `Generate a short, descriptive filename for a project plan document.

Goal: {GOAL_SUMMARY}

Rules:
- Title Case words, spaces allowed (e.g. "GraphQL Migration Plan", "Mobile App MVP")
- Max 50 characters, no file extension
- Focus on the project/task, not generic words like "plan" unless necessary
- Return ONLY the filename, nothing else`;

function buildNamingPrompt(goalSummary: string): string {
    return NAMING_PROMPT_TEMPLATE.replace('{GOAL_SUMMARY}', goalSummary);
}

function sanitizeFilename(raw: string): string {
    let name = raw.trim();
    name = name.replace(/^["']|["']$/g, '');
    name = name.replace(/\.\w+$/, '');
    name = name.replace(/[/\\:*?"<>|]/g, '');
    if (name.length > 60) {
        name = name.substring(0, 60).replace(/\s+$/, '');
    }
    return name;
}

// --- IPC helper (same pattern as other AI hooks) ---
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

// Build file context text from open editor files and the enabled attached file list
function buildFileContextFromOpenFiles(
    attachedFiles: AttachedFile[],
    openFiles: IFile[],
): string {
    const enabled = attachedFiles.filter(f => f.enabled !== false);
    if (enabled.length === 0) return '';

    const parts: string[] = [];
    for (const af of enabled) {
        const openFile = openFiles.find(f => f.path === af.path);
        if (openFile && openFile.content.trim()) {
            parts.push(`[File: ${af.name}]\n${openFile.content}`);
        }
    }
    return parts.join('\n\n---\n\n');
}

const PLANNING_MAX_TOKENS = 16384;

// --- Hook ---
export function useAIPlan() {
    const dispatch = useEditorDispatch();
    const state = useEditorState();

    const [isPlanLoading, setIsPlanLoading] = useState(false);
    const [planError, setPlanError] = useState<string | null>(null);
    const [planPhase, setPlanPhase] = useState<PlanPhase>(null);
    const [planComplete, setPlanComplete] = useState(false);
    const [planFileName, setPlanFileName] = useState<string | null>(null);
    const [hasSerperKey, setHasSerperKey] = useState<boolean | null>(null);

    const activeRequestIdRef = useRef<string | null>(null);
    const defaultLineEndingRef = useRef(state.config.defaultLineEnding);
    defaultLineEndingRef.current = state.config.defaultLineEnding;
    const openFilesRef = useRef(state.openFiles);
    openFilesRef.current = state.openFiles;

    // Check if Serper key is configured (lazy, once per submit)
    const checkSerperKey = useCallback(async (): Promise<boolean> => {
        if (hasSerperKey !== null) return hasSerperKey;
        try {
            const has = await window.electronAPI.hasApiKeyInStorage('serper');
            setHasSerperKey(has);
            return has;
        } catch {
            return false;
        }
    }, [hasSerperKey]);

    const submitPlan = useCallback(async (
        request: string,
        attachedFiles: AttachedFile[],
        provider: AIProvider,
        model: string,
        requestId: string,
    ) => {
        if (!request.trim()) {
            throw new Error('Please describe what you want to plan');
        }

        activeRequestIdRef.current = requestId;
        setIsPlanLoading(true);
        setPlanError(null);
        setPlanComplete(false);
        setPlanFileName(null);

        const startTime = Date.now();
        let currentPhaseForError: PlanPhase = null;
        console.log('[Plan] Starting', { request, provider, model, requestId });

        const fileContext = buildFileContextFromOpenFiles(attachedFiles, openFilesRef.current);

        try {
            // ── Step 1: Scoping ──────────────────────────────────────────────────────
            setPlanPhase('scoping');
            currentPhaseForError = 'scoping';
            let blueprint: PlanBlueprint = DEFAULT_BLUEPRINT;

            const scopingMessages = [{
                role: 'user' as const,
                content: buildScopingPrompt(request, fileContext),
            }];

            console.log('[Plan] Phase: scoping — calling API');
            const scopingResponse = await callChatApi(
                provider, scopingMessages, model, `${requestId}-scoping`
            );

            if (activeRequestIdRef.current !== requestId) return;

            if (scopingResponse.success && scopingResponse.response) {
                blueprint = parseBlueprintResponse(scopingResponse.response);
                console.log('[Plan] Scoping complete', {
                    elapsed: Date.now() - startTime,
                    blueprint,
                });
            } else {
                console.log('[Plan] Scoping failed, using defaults', {
                    elapsed: Date.now() - startTime,
                    error: scopingResponse.error,
                });
            }

            // ── Step 2: Web Research (optional Serper) ───────────────────────────────
            setPlanPhase('researching');
            currentPhaseForError = 'researching';
            let webResearchContext = '';

            const serperAvailable = await checkSerperKey();
            if (activeRequestIdRef.current !== requestId) return;

            if (serperAvailable && blueprint.searchQueries.length > 0) {
                console.log('[Plan] Phase: researching — running Serper searches', {
                    queries: blueprint.searchQueries,
                });
                const searchResults: string[] = [];
                for (const query of blueprint.searchQueries.slice(0, 4)) {
                    if (activeRequestIdRef.current !== requestId) return;
                    try {
                        const result = await window.electronAPI.serperSearch(query, 5);
                        if (result.success && result.results && result.results.length > 0) {
                            const formatted = result.results
                                .map(r => `- **${r.title}** (${r.link})\n  ${r.snippet}`)
                                .join('\n');
                            searchResults.push(`**Search: "${query}"**\n${formatted}`);
                        }
                    } catch {
                        console.log('[Plan] Serper search failed for query, continuing', { query });
                    }
                }
                if (searchResults.length > 0) {
                    webResearchContext = searchResults.join('\n\n');
                }
                console.log('[Plan] Research complete', {
                    elapsed: Date.now() - startTime,
                    queriesRun: searchResults.length,
                });
            } else {
                console.log('[Plan] Skipping web research', {
                    elapsed: Date.now() - startTime,
                    reason: serperAvailable ? 'no search queries from blueprint' : 'no Serper key configured',
                });
            }

            if (activeRequestIdRef.current !== requestId) return;

            // ── Step 3: Plan Generation ──────────────────────────────────────────────
            setPlanPhase('planning');
            currentPhaseForError = 'planning';

            const planningMessages = [{
                role: 'user' as const,
                content: buildPlanningPrompt(request, blueprint, webResearchContext, fileContext),
            }];

            console.log('[Plan] Phase: planning — calling API');
            const planResult = await callWithContinuation(
                callChatApi, provider, planningMessages, model,
                `${requestId}-planning`, '[Plan]', PLANNING_MAX_TOKENS
            );

            if (activeRequestIdRef.current !== requestId) return;

            const planContent = planResult.content;
            console.log('[Plan] Planning complete', {
                elapsed: Date.now() - startTime,
                contentLength: planContent.length,
                continuations: planResult.continuations,
            });

            // ── Step 4: Naming ───────────────────────────────────────────────────────
            setPlanPhase('naming');
            currentPhaseForError = 'naming';

            const namingMessages = [{
                role: 'user' as const,
                content: buildNamingPrompt(blueprint.goalSummary),
            }];

            console.log('[Plan] Phase: naming — calling API');
            let fileName = `plan-${request.toLowerCase().replace(/[^a-z0-9\s-]/g, '').replace(/\s+/g, '-').substring(0, 40)}.md`;

            const namingResponse = await callChatApi(
                provider, namingMessages, model, `${requestId}-naming`
            );

            if (activeRequestIdRef.current !== requestId) return;

            if (namingResponse.success && namingResponse.response) {
                const sanitized = sanitizeFilename(namingResponse.response);
                if (sanitized.length > 0) {
                    fileName = `${sanitized}.md`;
                }
            }

            console.log('[Plan] Naming complete', {
                elapsed: Date.now() - startTime,
                fileName,
            });

            // ── Open new file tab ────────────────────────────────────────────────────
            const fileId = generateId();
            dispatch({
                type: 'OPEN_FILE',
                payload: {
                    id: fileId,
                    path: null,
                    name: fileName,
                    content: planContent,
                    lineEnding: defaultLineEndingRef.current,
                    viewMode: 'preview' as const,
                    fileType: 'markdown' as const,
                },
            });

            setPlanFileName(fileName);
            setPlanPhase('complete');
            setPlanComplete(true);

            console.log('[Plan] Complete', {
                totalElapsed: Date.now() - startTime,
                fileName,
            });
        } catch (err) {
            if (activeRequestIdRef.current !== requestId) return;
            const message = err instanceof Error ? err.message : 'Plan request failed';
            console.error('[Plan] Error', {
                phase: currentPhaseForError,
                elapsed: Date.now() - startTime,
                error: message,
            });
            setPlanError(message);
            setPlanPhase(null);
            setPlanComplete(false);
            throw err;
        } finally {
            if (activeRequestIdRef.current === requestId) {
                activeRequestIdRef.current = null;
                setIsPlanLoading(false);
            }
        }
    }, [dispatch, checkSerperKey]);

    const dismissPlanProgress = useCallback(() => {
        setPlanPhase(null);
        setPlanComplete(false);
        setPlanFileName(null);
    }, []);

    const cancelPlan = useCallback(async () => {
        const requestId = activeRequestIdRef.current;
        activeRequestIdRef.current = null;
        setIsPlanLoading(false);
        setPlanPhase(null);
        setPlanComplete(false);
        setPlanFileName(null);
        setPlanError('Plan request canceled');

        if (requestId) {
            console.log('[Plan] Canceling', { requestId });
            for (const step of ['scoping', 'planning', 'naming']) {
                for (const suffix of ['', '-cont-1', '-cont-2', '-cont-3']) {
                    try {
                        await window.electronAPI.cancelAIChatRequest(`${requestId}-${step}${suffix}`);
                    } catch { /* ignore */ }
                }
            }
        }
    }, []);

    return {
        submitPlan,
        cancelPlan,
        dismissPlanProgress,
        isPlanLoading,
        planError,
        planPhase,
        planComplete,
        planFileName,
    };
}
