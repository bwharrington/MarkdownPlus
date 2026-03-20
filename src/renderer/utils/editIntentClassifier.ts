/**
 * Rule-based edit intent classifier.
 * Determines whether an edit instruction would benefit from web search,
 * allowing the pipeline to skip unnecessary searches for structural/stylistic edits.
 */

export type EditIntentCategory =
    | 'content'      // Adding/updating factual content — benefits from web search
    | 'structural'   // TOC, reordering, formatting — no web search needed
    | 'stylistic'    // Tone, grammar, voice changes — no web search needed
    | 'technical'    // Code examples, API references — benefits from web search
    | 'update';      // Updating data, statistics, versions — strongly benefits from web search

export interface EditIntentResult {
    category: EditIntentCategory;
    shouldSearch: boolean;
}

export function classifyEditIntent(instruction: string): EditIntentResult {
    const lower = instruction.toLowerCase();

    // Update — strongly benefits from web search
    const updatePatterns = [
        /\b(update|refresh)\b.*(statistic|data|number|figure|version|date)/,
        /\b(latest|current|recent|new|2025|2026)\b/,
        /\b(replace|swap)\b.*(outdated|old|deprecated)/,
    ];

    // Technical — benefits from web search
    const technicalPatterns = [
        /\b(add|include|insert)\b.*(code example|code snippet|sample code)/,
        /\b(add|include|insert)\b.*(api|endpoint|function|method)\b.*(example|reference|documentation)/,
        /\b(add|include)\b.*(installation|setup|getting started)\b.*(instruction|step|guide)/,
    ];

    // Structural — no web search needed
    const structuralPatterns = [
        /\b(table of contents|toc)\b/,
        /\b(reorder|rearrange|move|swap)\b.*(section|paragraph|heading)/,
        /\b(merge|split|combine)\b.*(section|paragraph)/,
        /\b(add|insert)\b.*(heading|header|divider|separator|horizontal rule)/,
        /\b(number|renumber)\b.*(section|heading|list)/,
        /\b(indent|outdent|nest)\b/,
        /\b(format|reformat)\b.*(table|list|code block)/,
        /\b(convert)\b.*(bullet|numbered|list|table)/,
    ];

    // Stylistic — no web search needed
    const stylisticPatterns = [
        /\b(fix|correct)\b.*(grammar|spelling|typo|punctuation)/,
        /\b(make|change)\b.*(tone|voice|casual|formal|professional|friendly)/,
        /\b(shorten|lengthen|expand|condense|summarize|simplify)\b/,
        /\b(rephrase|rewrite|reword)\b/,
        /\b(proofread|polish|clean up)\b/,
    ];

    if (updatePatterns.some(p => p.test(lower))) {
        return { category: 'update', shouldSearch: true };
    }
    if (technicalPatterns.some(p => p.test(lower))) {
        return { category: 'technical', shouldSearch: true };
    }
    if (structuralPatterns.some(p => p.test(lower))) {
        return { category: 'structural', shouldSearch: false };
    }
    if (stylisticPatterns.some(p => p.test(lower))) {
        return { category: 'stylistic', shouldSearch: false };
    }

    // Default: content — defer to user's toggle (they enabled web search for a reason)
    return { category: 'content', shouldSearch: true };
}
