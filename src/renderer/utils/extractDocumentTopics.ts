/**
 * Extract topic headings from a markdown document for use in Go Deeper topic selection.
 * Filters out structural/meta headings, deduplicates against excludeTopics, caps at 8.
 */

const EXCLUDED_HEADING_PATTERNS = [
    /^changelog/i,
    /^sources?$/i,
    /^references?$/i,
    /^deep dive addendum/i,
    /^appendix/i,
    /^table of contents/i,
    /^toc$/i,
    /^introduction$/i,
    /^conclusion$/i,
    /^summary$/i,
    /^overview$/i,
    /^executive summary/i,
    /^further reading/i,
    /^see also/i,
    /^notes?$/i,
    /^footnotes?$/i,
    /^bibliography/i,
];

const MAX_DOCUMENT_TOPICS = 8;

function isExcludedHeading(heading: string): boolean {
    return EXCLUDED_HEADING_PATTERNS.some(pattern => pattern.test(heading.trim()));
}

function normalizeForComparison(s: string): string {
    return s.toLowerCase().trim();
}

/**
 * Extracts ## and ### headings from a markdown string as topic candidates.
 *
 * @param markdown - The document content to parse
 * @param excludeTopics - Topics already present (e.g. AI-suggested topics) to deduplicate against
 * @returns Up to 8 unique headings suitable as expansion topics
 */
export function extractDocumentTopics(
    markdown: string,
    excludeTopics: string[] = [],
): string[] {
    const excludeNormalized = new Set(excludeTopics.map(normalizeForComparison));
    const seen = new Set<string>();
    const results: string[] = [];

    const lines = markdown.split('\n');

    for (const line of lines) {
        if (results.length >= MAX_DOCUMENT_TOPICS) break;

        // Match ## or ### headings (not # top-level, not #### deeper)
        const match = line.match(/^#{2,3}\s+(.+)$/);
        if (!match) continue;

        const heading = match[1].trim();

        // Filter out structural/meta headings
        if (isExcludedHeading(heading)) continue;

        const normalized = normalizeForComparison(heading);

        // Skip duplicates within results
        if (seen.has(normalized)) continue;

        // Skip if already covered by AI-suggested topics
        if (excludeNormalized.has(normalized)) continue;

        // Fuzzy dedupe: skip if any exclude topic is a substring or vice versa
        const isSubstantialOverlap = Array.from(excludeNormalized).some(exclude =>
            normalized.includes(exclude) || exclude.includes(normalized)
        );
        if (isSubstantialOverlap) continue;

        seen.add(normalized);
        results.push(heading);
    }

    return results;
}
