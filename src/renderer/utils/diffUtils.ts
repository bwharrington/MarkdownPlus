import type { DiffHunk } from '../types/diffTypes';

/** A single line in the diff output */
export interface DiffLine {
    type: 'unchanged' | 'added' | 'removed';
    content: string;
    hunkId: string | null;
    hunkStatus: 'pending' | 'accepted' | 'rejected' | null;
    isFirstLineOfHunk: boolean;
    isCurrentHunk: boolean;
}

/** Build a flat array of DiffLines from the diff session */
export function buildDiffLines(
    originalContent: string,
    hunks: DiffHunk[],
    currentHunkIndex: number
): DiffLine[] {
    const originalLines = originalContent.replace(/\r\n/g, '\n').split('\n');
    const sortedHunks = [...hunks].sort((a, b) => a.startLine - b.startLine);
    const currentHunk = currentHunkIndex >= 0 && currentHunkIndex < sortedHunks.length
        ? hunks[currentHunkIndex]
        : null;
    const result: DiffLine[] = [];
    let origIdx = 0;

    for (const hunk of sortedHunks) {
        // Add unchanged lines before this hunk
        while (origIdx < hunk.startLine && origIdx < originalLines.length) {
            result.push({
                type: 'unchanged',
                content: originalLines[origIdx],
                hunkId: null,
                hunkStatus: null,
                isFirstLineOfHunk: false,
                isCurrentHunk: false,
            });
            origIdx++;
        }

        const isCurrent = currentHunk?.id === hunk.id;

        if (hunk.status === 'pending') {
            // Show removed lines (original)
            if (hunk.type === 'remove' || hunk.type === 'modify') {
                hunk.originalLines.forEach((line, i) => {
                    result.push({
                        type: 'removed',
                        content: line,
                        hunkId: hunk.id,
                        hunkStatus: 'pending',
                        isFirstLineOfHunk: i === 0,
                        isCurrentHunk: isCurrent,
                    });
                });
            }
            // Show added lines (new)
            if (hunk.type === 'add' || hunk.type === 'modify') {
                hunk.newLines.forEach((line, i) => {
                    result.push({
                        type: 'added',
                        content: line,
                        hunkId: hunk.id,
                        hunkStatus: 'pending',
                        isFirstLineOfHunk: hunk.originalLines.length === 0 && i === 0,
                        isCurrentHunk: isCurrent,
                    });
                });
            }
        } else if (hunk.status === 'accepted') {
            // Show only the new lines as normal text
            hunk.newLines.forEach((line) => {
                result.push({
                    type: 'unchanged',
                    content: line,
                    hunkId: null,
                    hunkStatus: null,
                    isFirstLineOfHunk: false,
                    isCurrentHunk: false,
                });
            });
        } else {
            // Rejected: show original lines as normal text
            hunk.originalLines.forEach((line) => {
                result.push({
                    type: 'unchanged',
                    content: line,
                    hunkId: null,
                    hunkStatus: null,
                    isFirstLineOfHunk: false,
                    isCurrentHunk: false,
                });
            });
        }

        // Skip original lines consumed by this hunk
        if (hunk.type === 'remove' || hunk.type === 'modify') {
            origIdx = hunk.endLine + 1;
        }
    }

    // Remaining unchanged lines
    while (origIdx < originalLines.length) {
        result.push({
            type: 'unchanged',
            content: originalLines[origIdx],
            hunkId: null,
            hunkStatus: null,
            isFirstLineOfHunk: false,
            isCurrentHunk: false,
        });
        origIdx++;
    }

    return result;
}
