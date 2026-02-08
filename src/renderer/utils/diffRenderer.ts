import { escapeHtml } from './domUtils';
import type { DiffSession } from '../types/diffTypes';

/**
 * Render diff content as HTML string with highlighted changes
 */
export function renderDiffContent(diffSession: DiffSession): string {
    const originalLines = diffSession.originalContent.split('\n');
    const hunks = diffSession.hunks;

    // If no hunks or all resolved, just show the current content
    if (hunks.length === 0 || hunks.every(h => h.status !== 'pending')) {
        return originalLines.map(line => escapeHtml(line)).join('\n');
    }

    // Build the diff view by processing hunks
    const result: string[] = [];
    let origIdx = 0;

    // Sort hunks by start line
    const sortedHunks = [...hunks].sort((a, b) => a.startLine - b.startLine);

    for (const hunk of sortedHunks) {
        // Add unchanged lines before this hunk
        while (origIdx < hunk.startLine && origIdx < originalLines.length) {
            result.push(escapeHtml(originalLines[origIdx]));
            origIdx++;
        }

        const isCurrent = hunk.id === diffSession.hunks[diffSession.currentHunkIndex]?.id;
        const currentClass = isCurrent ? ' diff-current' : '';

        if (hunk.status === 'pending') {
            // Show both removed and added lines for pending hunks
            if (hunk.type === 'remove' || hunk.type === 'modify') {
                // Show original lines as removed
                for (const line of hunk.originalLines) {
                    result.push(`<span class="diff-removed${currentClass}">${escapeHtml(line)}</span>`);
                }
            }
            if (hunk.type === 'add' || hunk.type === 'modify') {
                // Show new lines as added
                for (const line of hunk.newLines) {
                    result.push(`<span class="diff-added${currentClass}">${escapeHtml(line)}</span>`);
                }
            }
        } else if (hunk.status === 'accepted') {
            // Show only the new lines (accepted change)
            for (const line of hunk.newLines) {
                result.push(escapeHtml(line));
            }
        } else {
            // Show only the original lines (rejected change)
            for (const line of hunk.originalLines) {
                result.push(escapeHtml(line));
            }
        }

        // Skip the original lines that were part of this hunk
        if (hunk.type === 'remove' || hunk.type === 'modify') {
            origIdx = hunk.endLine + 1;
        }
    }

    // Add remaining unchanged lines
    while (origIdx < originalLines.length) {
        result.push(escapeHtml(originalLines[origIdx]));
        origIdx++;
    }

    return result.join('\n');
}
