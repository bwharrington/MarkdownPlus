import { useState, useCallback, useRef } from 'react';
import { useEditorDispatch, useEditorState } from '../contexts/EditorContext';
import type { AIProvider } from './useAIChat';
import { closeUnclosedFences } from '../utils/sanitizeMarkdown';
import { callWithContinuation } from '../utils/callWithContinuation';
import type { GoDeepDepthLevel } from './useAIGoDeeper';

// Generate unique ID (same pattern as other AI hooks)
const generateId = () => Math.random().toString(36).substring(2, 11);

export type InsightForgePhase =
    | 'scoping'     // Step 1: Parse query → JSON blueprint
    | 'extraction'  // Step 2: Extract mechanics per blueprint [WEB SEARCH PLACEHOLDER]
    | 'analysis'    // Step 3: Section-by-section deep analysis (with embedded self-review)
    | 'assembly'    // Step 4: Final Markdown template + filename generation
    | 'complete'
    | null;

// --- Depth level instructions (shared pattern from useAIResearch) ---
const DEPTH_INSTRUCTIONS: Record<GoDeepDepthLevel, string> = {
    beginner: `Write for someone new to this topic. Prioritize clear explanations over jargon. Define technical terms when introduced. Use simple, well-commented code examples. Focus on "what it is" and "why it matters" before "how it works". Avoid assuming prior knowledge.`,
    practitioner: `Write for someone who actively works with this technology. Focus on practical patterns, real-world usage, and working code. Include common pitfalls and how to avoid them. Assume familiarity with fundamentals but explain non-obvious behaviors.`,
    expert: `Write for a deep technical expert. Prioritize internals, implementation trade-offs, edge cases, and production-scale concerns. Include advanced code patterns, performance considerations, and architectural decisions. Skip introductory explanations.`,
};

const DEPTH_LABEL: Record<GoDeepDepthLevel, string> = {
    beginner: 'Beginner',
    practitioner: 'Practitioner',
    expert: 'Expert',
};

// --- Blueprint types ---
interface InsightBlueprint {
    primarySources: string[];
    secondarySources: string[];
    coverageAreas: string[];
    keyTerms: string[];
}

const DEFAULT_BLUEPRINT: InsightBlueprint = {
    primarySources: ['official documentation', 'language/framework specification'],
    secondarySources: ['maintainer blog posts', 'RFC or proposal documents', 'high-signal community discussions'],
    coverageAreas: ['core mechanics', 'implementation patterns', 'common pitfalls', 'usage trade-offs'],
    keyTerms: [],
};

// --- Step 1: Scoping Prompt ---
const SCOPING_PROMPT_TEMPLATE = `Analyze this software engineering topic and output a JSON research blueprint only. No other text.

Topic: "{TOPIC}"
Target depth level: {DEPTH_LABEL}

Identify the best sources and coverage areas for a rigorous technical deep-dive at {DEPTH_LABEL} level.

{
  "primarySources": ["<official docs URL or site name>", "<specification or RFC>"],
  "secondarySources": ["<maintainer blog or talk>", "<seminal GitHub issue or PR>", "<trusted technical post>"],
  "coverageAreas": ["<aspect 1>", "<aspect 2>", "<aspect 3>", "<aspect 4>", "<aspect 5>"],
  "keyTerms": ["<key technical term 1>", "<key technical term 2>", "<key technical term 3>"]
}`;

function buildScopingPrompt(topic: string, depthLevel: GoDeepDepthLevel): string {
    return SCOPING_PROMPT_TEMPLATE
        .replaceAll('{TOPIC}', topic)
        .replaceAll('{DEPTH_LABEL}', DEPTH_LABEL[depthLevel]);
}

function parseBlueprintResponse(text: string): InsightBlueprint {
    try {
        const parsed = JSON.parse(text);
        if (parsed.primarySources && parsed.coverageAreas) {
            return {
                primarySources: Array.isArray(parsed.primarySources) ? parsed.primarySources : DEFAULT_BLUEPRINT.primarySources,
                secondarySources: Array.isArray(parsed.secondarySources) ? parsed.secondarySources : DEFAULT_BLUEPRINT.secondarySources,
                coverageAreas: Array.isArray(parsed.coverageAreas) ? parsed.coverageAreas : DEFAULT_BLUEPRINT.coverageAreas,
                keyTerms: Array.isArray(parsed.keyTerms) ? parsed.keyTerms : [],
            };
        }
    } catch { /* fall through */ }

    // Try extracting JSON from code fences or surrounding text
    const jsonMatch = text.match(/\{[\s\S]*?"primarySources"[\s\S]*?"coverageAreas"[\s\S]*?\}/);
    if (jsonMatch) {
        try {
            const parsed = JSON.parse(jsonMatch[0]);
            if (parsed.primarySources && parsed.coverageAreas) {
                return {
                    primarySources: Array.isArray(parsed.primarySources) ? parsed.primarySources : DEFAULT_BLUEPRINT.primarySources,
                    secondarySources: Array.isArray(parsed.secondarySources) ? parsed.secondarySources : DEFAULT_BLUEPRINT.secondarySources,
                    coverageAreas: Array.isArray(parsed.coverageAreas) ? parsed.coverageAreas : DEFAULT_BLUEPRINT.coverageAreas,
                    keyTerms: Array.isArray(parsed.keyTerms) ? parsed.keyTerms : [],
                };
            }
        } catch { /* fall through */ }
    }

    return DEFAULT_BLUEPRINT;
}

// --- Step 2: Extraction Prompt ---
// WEB_SEARCH_PLACEHOLDER_START
// Future: This step will integrate a web search API (e.g., Brave Search, Serper)
// to fetch live content from blueprint.primarySources and inject extracted text here.
// Implementation plan: see docs/InsightForge-WebSearch-Roadmap.md (planned separate feature)
// For now, the AI uses its training knowledge for source extraction.
// WEB_SEARCH_PLACEHOLDER_END
const EXTRACTION_PROMPT_TEMPLATE = `You are extracting concise technical reference material on: "{TOPIC}"

Depth: {DEPTH_LABEL}. {DEPTH_INSTRUCTIONS}

Sources to draw from: {PRIMARY_SOURCES}; {SECONDARY_SOURCES}

For each coverage area listed below, write a tight bullet-point summary (3–6 bullets each) covering: core mechanics, key API/config options, known pitfalls, and any version notes.

Coverage areas: {COVERAGE_AREAS}
Key terms to define: {KEY_TERMS}

Keep total output under 2000 words. Bullets only — no narrative prose. Accuracy over completeness.`;

function buildExtractionPrompt(topic: string, blueprint: InsightBlueprint, depthLevel: GoDeepDepthLevel): string {
    return EXTRACTION_PROMPT_TEMPLATE
        .replaceAll('{TOPIC}', topic)
        .replaceAll('{DEPTH_LABEL}', DEPTH_LABEL[depthLevel])
        .replaceAll('{DEPTH_INSTRUCTIONS}', DEPTH_INSTRUCTIONS[depthLevel])
        .replaceAll('{PRIMARY_SOURCES}', blueprint.primarySources.join(', '))
        .replaceAll('{SECONDARY_SOURCES}', blueprint.secondarySources.join(', '))
        .replaceAll('{COVERAGE_AREAS}', blueprint.coverageAreas.join(', '))
        .replaceAll('{KEY_TERMS}', blueprint.keyTerms.length > 0 ? blueprint.keyTerms.join(', ') : 'as identified from the topic');
}

// --- Step 3: Analysis + Self-Review Prompt (merged) ---
// Note: The neutrality gate (originally Step 4) is embedded here as a final self-review
// instruction to avoid sending ~50K chars back as input to a separate review request.
const ANALYSIS_PROMPT_TEMPLATE = `You are writing a technical deep-dive document on: "{TOPIC}"

Depth: {DEPTH_LABEL}. {DEPTH_INSTRUCTIONS}

Reference material (bullet summaries per coverage area):
{EXTRACTED_CONTENT}

---

Write the 13 sections below using the exact headings. Be substantive but focused — target 300–500 words per section. Ground every claim in the reference material.

## Why This Exists
The core problem it solves and real-world contexts where it fits. Include historical context.

## Core Mechanics
How it works under the hood. Spec → runtime behavior, data flow, lifecycle.

## Implementation & Configuration
Setup patterns, required options, version notes. Include code examples scaled to {DEPTH_LABEL} level.

## Usage Patterns & Best Practices
Production-proven patterns and why they work.

## Common Pitfalls & Failure Modes
What breaks, why, and the observable symptoms. Concrete over generic.

## Performance & Scalability
What degrades under load, where bottlenecks appear, and how to profile or mitigate them.

## Testing Strategies
How to write effective tests for code that uses this technology. Unit, integration, and E2E approaches where relevant.

## Security Considerations
Common vulnerabilities, attack surfaces, and hardening patterns specific to this technology.

## Debugging & Observability
How to diagnose issues at runtime. Useful tooling, logging strategies, common error signatures and what they mean.

## Architecture Patterns
How this technology fits into larger system designs — monolith, microservices, serverless, event-driven. When it helps and when it adds friction.

## Advantages in Context
Scenario-based framing only: "In [context], [tool] gives [specific benefit]". No "X is better than Y" language.

## Ecosystem & Related Concepts
Adjacent tools, typical pairings, and how they fit together.

## Community & Governance
Release cadence, stability signals, who maintains it, health of the ecosystem, and where to follow developments.

---

Before outputting, apply this self-review:
- Replace any superiority claims with scenario-based framing
- Ensure every pitfall includes a concrete symptom or solution
- Add "(verify against current docs)" to any version-specific claim you're uncertain about

Do NOT include a Curated Resources section.`;

function buildAnalysisPrompt(topic: string, extractedContent: string, depthLevel: GoDeepDepthLevel): string {
    return ANALYSIS_PROMPT_TEMPLATE
        .replaceAll('{TOPIC}', topic)
        .replaceAll('{DEPTH_LABEL}', DEPTH_LABEL[depthLevel])
        .replaceAll('{DEPTH_INSTRUCTIONS}', DEPTH_INSTRUCTIONS[depthLevel])
        .replaceAll('{EXTRACTED_CONTENT}', extractedContent);
}

// --- Step 5: Assembly Prompt ---
const ASSEMBLY_PROMPT_TEMPLATE = `You are assembling the final Insight Forge document on: "{TOPIC}"

Depth level: {DEPTH_LABEL}

You have two tasks:

**Task 1: Curated Resources**
Generate 5–8 curated resource links for this topic. Each must have a one-sentence annotation describing its value. Prioritize:
- Official documentation (primary reference)
- Maintainer or core team technical writing
- Specification, RFC, or proposal document
- Practical implementation deep-dive
- High-signal community discussion (e.g. GitHub issue, StackOverflow canonical answer)

Format as:
- [Resource Title](url) – one-sentence value description

**Task 2: Final Assembly**
Assemble the complete document using this exact template. Replace the draft content into the correct sections and append the Curated Resources section at the end.

First, derive a SHORT_TOPIC: the core subject in 1–3 words (e.g. "React", "Angular", "useEffect", "C Memory Management", "Hasura GraphQL Auth"). Strip filler words like "Help me understand", "How to use", "Introduction to", etc.

Output the complete assembled document as JSON with this structure (and nothing else):
{
  "content": "<full markdown document>",
  "filename": "<kebab-case-filename-max-60-chars>"
}

Filename rules: kebab-case, max 60 characters, no extension, descriptive (e.g. "react-useeffect-deep-dive", "hasura-graphql-authentication"). The filename will have .md appended automatically.

**Document template to follow exactly (replace SHORT_TOPIC with your derived short topic):**

# SHORT_TOPIC

## Why SHORT_TOPIC Exists
[content here]

## Core Mechanics
[content here]

## Implementation & Configuration
[content here]

## Usage Patterns & Best Practices
[content here]

## Common Pitfalls & Failure Modes
[content here]

## Performance & Scalability
[content here]

## Testing Strategies
[content here]

## Security Considerations
[content here]

## Debugging & Observability
[content here]

## Architecture Patterns
[content here]

## Advantages in Context
[content here]

## Ecosystem & Related Concepts
[content here]

## Community & Governance
[content here]

## Curated Resources
[generated links here]

---
*Generated by Insight Forge · Depth: {DEPTH_LABEL}*

**Reviewed draft to assemble:**
{REVIEWED_CONTENT}`;

function buildAssemblyPrompt(topic: string, reviewedContent: string, depthLevel: GoDeepDepthLevel): string {
    return ASSEMBLY_PROMPT_TEMPLATE
        .replaceAll('{TOPIC}', topic)
        .replaceAll('{DEPTH_LABEL}', DEPTH_LABEL[depthLevel])
        .replaceAll('{REVIEWED_CONTENT}', reviewedContent);
}

interface AssemblyResult {
    content: string;
    filename: string;
}

function parseAssemblyResponse(text: string, topic: string): AssemblyResult {
    // Strategy 1: pure JSON
    try {
        const parsed = JSON.parse(text);
        if (parsed.content && parsed.filename) {
            return { content: parsed.content as string, filename: parsed.filename as string };
        }
    } catch { /* fall through */ }

    // Strategy 2: strip markdown code fences
    const fenceMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (fenceMatch) {
        try {
            const parsed = JSON.parse(fenceMatch[1]);
            if (parsed.content && parsed.filename) {
                return { content: parsed.content as string, filename: parsed.filename as string };
            }
        } catch { /* fall through */ }
    }

    // Strategy 3: find first '{' and last '}' in the response
    const firstBrace = text.indexOf('{');
    const lastBrace = text.lastIndexOf('}');
    if (firstBrace !== -1 && lastBrace > firstBrace) {
        try {
            const parsed = JSON.parse(text.slice(firstBrace, lastBrace + 1));
            if (parsed.content && parsed.filename) {
                return { content: parsed.content as string, filename: parsed.filename as string };
            }
        } catch { /* fall through */ }
    }

    // Fallback: use the text as-is with a generated filename
    const slug = topic.toLowerCase().replace(/[^a-z0-9\s-]/g, '').replace(/\s+/g, '-').substring(0, 55);
    return {
        content: text,
        filename: `${slug}-insight-forge`,
    };
}

function sanitizeFilename(raw: string): string {
    let name = raw.trim();
    name = name.replace(/^["']|["']$/g, '');
    name = name.replace(/\.\w+$/, '');
    name = name.replace(/[/\\:*?"<>|]/g, '');
    name = name.replace(/\s+/g, '-');
    name = name.toLowerCase();
    if (name.length > 60) {
        name = name.substring(0, 60).replace(/-+$/, '');
    }
    return name;
}

// --- IPC helper (same as useAIResearch) ---
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

const EXTRACTION_MAX_TOKENS = 4096;  // Bullet summaries — keep concise
const ANALYSIS_MAX_TOKENS = 16384;   // Full 7-section draft with self-review
const ASSEMBLY_MAX_TOKENS = 16384;   // Final template + resources + filename

// --- Hook ---
export function useAIInsightForge() {
    const dispatch = useEditorDispatch();
    const state = useEditorState();

    const [isInsightForgeLoading, setIsInsightForgeLoading] = useState(false);
    const [insightForgeError, setInsightForgeError] = useState<string | null>(null);
    const [insightForgePhase, setInsightForgePhase] = useState<InsightForgePhase>(null);
    const [insightForgeComplete, setInsightForgeComplete] = useState(false);
    const [insightForgeFileName, setInsightForgeFileName] = useState<string | null>(null);
    const activeRequestIdRef = useRef<string | null>(null);
    const defaultLineEndingRef = useRef(state.config.defaultLineEnding);
    defaultLineEndingRef.current = state.config.defaultLineEnding;


    const submitInsightForge = useCallback(async (
        query: string,
        provider: AIProvider,
        model: string,
        requestId: string,
        depthLevel: GoDeepDepthLevel = 'practitioner',
    ) => {
        if (!query.trim()) {
            throw new Error('Please enter a topic for Insight Forge');
        }

        activeRequestIdRef.current = requestId;
        setIsInsightForgeLoading(true);
        setInsightForgeError(null);
        setInsightForgeComplete(false);
        setInsightForgeFileName(null);

        const startTime = Date.now();
        console.log('[InsightForge] Starting', { query, provider, model, requestId, depthLevel });

        try {
            // ── Step 1: Scoping ──────────────────────────────────────────────────────
            setInsightForgePhase('scoping');
            let blueprint: InsightBlueprint = DEFAULT_BLUEPRINT;

            const scopingMessages = [{
                role: 'user' as const,
                content: buildScopingPrompt(query, depthLevel),
            }];

            console.log('[InsightForge] Phase: scoping — calling API');
            const scopingResponse = await callChatApi(
                provider, scopingMessages, model, `${requestId}-scoping`
            );

            if (activeRequestIdRef.current !== requestId) return;

            if (scopingResponse.success && scopingResponse.response) {
                blueprint = parseBlueprintResponse(scopingResponse.response);
                console.log('[InsightForge] Scoping complete', {
                    elapsed: Date.now() - startTime,
                    blueprint,
                });
            } else {
                console.log('[InsightForge] Scoping failed, using defaults', {
                    elapsed: Date.now() - startTime,
                    error: scopingResponse.error,
                });
            }

            // ── Step 2: Extraction ───────────────────────────────────────────────────
            // WEB_SEARCH_PLACEHOLDER_START
            // Future: This step will integrate a web search API (e.g., Brave Search, Serper)
            // to fetch live content from blueprint.primarySources and inject extracted text here.
            // Implementation plan: see docs/InsightForge-WebSearch-Roadmap.md (planned separate feature)
            // For now, the AI uses its training knowledge for source extraction.
            // WEB_SEARCH_PLACEHOLDER_END
            setInsightForgePhase('extraction');

            const extractionMessages = [{
                role: 'user' as const,
                content: buildExtractionPrompt(query, blueprint, depthLevel),
            }];

            console.log('[InsightForge] Phase: extraction — calling API');
            const extractionResult = await callWithContinuation(
                callChatApi, provider, extractionMessages, model,
                `${requestId}-extraction`, '[InsightForge]', EXTRACTION_MAX_TOKENS
            );

            if (activeRequestIdRef.current !== requestId) return;

            const extractedContent = extractionResult.content;
            console.log('[InsightForge] Extraction complete', {
                elapsed: Date.now() - startTime,
                contentLength: extractedContent.length,
                continuations: extractionResult.continuations,
            });

            // ── Step 3: Analysis ─────────────────────────────────────────────────────
            setInsightForgePhase('analysis');

            const analysisMessages = [{
                role: 'user' as const,
                content: buildAnalysisPrompt(query, extractedContent, depthLevel),
            }];

            console.log('[InsightForge] Phase: analysis — calling API');
            const analysisResult = await callWithContinuation(
                callChatApi, provider, analysisMessages, model,
                `${requestId}-analysis`, '[InsightForge]', ANALYSIS_MAX_TOKENS
            );

            if (activeRequestIdRef.current !== requestId) return;

            const draftContent = closeUnclosedFences(analysisResult.content);
            console.log('[InsightForge] Analysis complete', {
                elapsed: Date.now() - startTime,
                contentLength: draftContent.length,
                continuations: analysisResult.continuations,
            });

            // ── Step 4: Assembly ─────────────────────────────────────────────────────
            setInsightForgePhase('assembly');

            const assemblyMessages = [{
                role: 'user' as const,
                content: buildAssemblyPrompt(query, draftContent, depthLevel),
            }];

            console.log('[InsightForge] Phase: assembly — calling API');
            const assemblyResult = await callWithContinuation(
                callChatApi, provider, assemblyMessages, model,
                `${requestId}-assembly`, '[InsightForge]', ASSEMBLY_MAX_TOKENS
            );

            if (activeRequestIdRef.current !== requestId) return;

            const { content: finalContent, filename: rawFilename } = parseAssemblyResponse(
                assemblyResult.content,
                query
            );

            const sanitizedFilename = sanitizeFilename(rawFilename);
            const fileName = sanitizedFilename.length > 0
                ? `${sanitizedFilename}.md`
                : `insight-forge-${query.toLowerCase().replace(/\s+/g, '-').substring(0, 40)}.md`;

            console.log('[InsightForge] Assembly complete', {
                elapsed: Date.now() - startTime,
                contentLength: finalContent.length,
                fileName,
                continuations: assemblyResult.continuations,
            });

            // ── Open new file tab ────────────────────────────────────────────────────
            const fileId = generateId();
            dispatch({
                type: 'OPEN_FILE',
                payload: {
                    id: fileId,
                    path: null,
                    name: fileName,
                    content: finalContent,
                    lineEnding: defaultLineEndingRef.current,
                    viewMode: 'preview' as const,
                    fileType: 'markdown' as const,
                },
            });

            setInsightForgeFileName(fileName);
            setInsightForgePhase('complete');
            setInsightForgeComplete(true);

            console.log('[InsightForge] Complete', {
                totalElapsed: Date.now() - startTime,
                fileName,
            });
        } catch (err) {
            if (activeRequestIdRef.current !== requestId) return;
            const message = err instanceof Error ? err.message : 'Insight Forge request failed';
            console.error('[InsightForge] Error', {
                phase: insightForgePhase,
                elapsed: Date.now() - startTime,
                error: message,
            });
            setInsightForgeError(message);
            setInsightForgePhase(null);
            setInsightForgeComplete(false);
            throw err;
        } finally {
            if (activeRequestIdRef.current === requestId) {
                activeRequestIdRef.current = null;
                setIsInsightForgeLoading(false);
            }
        }
    }, [dispatch]);

    const dismissInsightForgeProgress = useCallback(() => {
        setInsightForgePhase(null);
        setInsightForgeComplete(false);
        setInsightForgeFileName(null);
    }, []);

    const cancelInsightForge = useCallback(async () => {
        const requestId = activeRequestIdRef.current;
        activeRequestIdRef.current = null;
        setIsInsightForgeLoading(false);
        setInsightForgePhase(null);
        setInsightForgeComplete(false);
        setInsightForgeFileName(null);
        setInsightForgeError('Insight Forge request canceled');

        if (requestId) {
            console.log('[InsightForge] Canceling', { requestId });
            for (const step of ['scoping', 'extraction', 'analysis', 'assembly']) {
                for (const suffix of ['', '-cont-1', '-cont-2', '-cont-3']) {
                    try {
                        await window.electronAPI.cancelAIChatRequest(`${requestId}-${step}${suffix}`);
                    } catch { /* ignore */ }
                }
            }
        }
    }, []);

    return {
        submitInsightForge,
        cancelInsightForge,
        dismissInsightForgeProgress,
        isInsightForgeLoading,
        insightForgeError,
        insightForgePhase,
        insightForgeComplete,
        insightForgeFileName,
    };
}
