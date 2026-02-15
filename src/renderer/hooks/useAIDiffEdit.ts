import { useCallback } from 'react';
import { diffLines } from 'diff';
import { useEditorDispatch, useEditorState, useActiveFile } from '../contexts/EditorContext';
import type { DiffHunk } from '../types/diffTypes';

// Generate unique ID
const generateId = () => Math.random().toString(36).substring(2, 11);

// Format the edit request for the AI
function formatEditRequest(prompt: string, fileContent: string, fileName: string): string {
    return `Edit the following markdown document.

File: ${fileName}

Requested changes:
${prompt}

Current document:
\`\`\`markdown
${fileContent}
\`\`\`

Return a JSON object with the complete modified document.`;
}

/** Maximum number of unchanged lines between hunks to still merge them */
const MERGE_GAP_THRESHOLD = 2;

/**
 * Compute diff hunks between original and modified content.
 * Merges consecutive add/remove pairs into 'modify' hunks and
 * post-processes to merge nearby hunks (within MERGE_GAP_THRESHOLD
 * unchanged lines) into a single grouped hunk.
 */
export function computeDiffHunks(original: string, modified: string): DiffHunk[] {
    // Normalize line endings to LF before diffing to avoid CRLF vs LF false diffs
    const normalizedOriginal = original.replace(/\r\n/g, '\n');
    const normalizedModified = modified.replace(/\r\n/g, '\n');
    const changes = diffLines(normalizedOriginal, normalizedModified);
    const rawHunks: DiffHunk[] = [];
    let lineNumber = 0;

    // --- Pass 1: Build raw hunks from diff output ---
    for (let i = 0; i < changes.length; i++) {
        const change = changes[i];
        // Split value into lines, handling the trailing newline carefully
        const lines = change.value.endsWith('\n')
            ? change.value.slice(0, -1).split('\n')
            : change.value.split('\n');

        if (change.added) {
            // Check if previous diff change was a removal - this is a modification
            const prevChange = changes[i - 1];
            const prevHunk = rawHunks.length > 0 ? rawHunks[rawHunks.length - 1] : null;
            if (prevHunk && prevHunk.type === 'remove' && prevChange?.removed) {
                // Merge with previous removal to create a 'modify' hunk
                prevHunk.newLines = lines;
                prevHunk.type = 'modify';
            } else {
                rawHunks.push({
                    id: generateId(),
                    startLine: lineNumber,
                    endLine: lineNumber,
                    originalLines: [],
                    newLines: lines,
                    type: 'add',
                    status: 'pending',
                });
            }
        } else if (change.removed) {
            rawHunks.push({
                id: generateId(),
                startLine: lineNumber,
                endLine: lineNumber + lines.length - 1,
                originalLines: lines,
                newLines: [],
                type: 'remove',
                status: 'pending',
            });
            lineNumber += lines.length;
        } else {
            // Unchanged lines
            lineNumber += lines.length;
        }
    }

    if (rawHunks.length <= 1) {
        return rawHunks;
    }

    // --- Pass 2: Merge nearby hunks separated by few unchanged lines ---
    const originalLines = normalizedOriginal.split('\n');
    const merged: DiffHunk[] = [rawHunks[0]];

    for (let i = 1; i < rawHunks.length; i++) {
        const prev = merged[merged.length - 1];
        const curr = rawHunks[i];

        // Calculate the gap of unchanged lines between the two hunks
        const prevEnd = prev.type === 'add' ? prev.startLine : prev.endLine + 1;
        const gapStart = prevEnd;
        const gapEnd = curr.startLine;
        const gap = gapEnd - gapStart;

        if (gap <= MERGE_GAP_THRESHOLD) {
            // Merge: include the bridging unchanged lines in both original and new
            const bridgeLines = originalLines.slice(gapStart, gapEnd);

            // Combine original lines: prev original + bridge + curr original
            const combinedOriginal = [...prev.originalLines, ...bridgeLines, ...curr.originalLines];
            // Combine new lines: prev new + bridge + curr new
            const combinedNew = [...prev.newLines, ...bridgeLines, ...curr.newLines];

            prev.originalLines = combinedOriginal;
            prev.newLines = combinedNew;
            prev.startLine = Math.min(prev.startLine, curr.startLine);
            prev.endLine = Math.max(
                prev.type === 'add' ? prev.startLine : prev.endLine,
                curr.type === 'add' ? curr.startLine : curr.endLine
            );
            // If either side has content, it's a modify; otherwise keep whichever type applies
            if (combinedOriginal.length > 0 && combinedNew.length > 0) {
                prev.type = 'modify';
            } else if (combinedOriginal.length > 0) {
                prev.type = 'remove';
            } else {
                prev.type = 'add';
            }
        } else {
            merged.push(curr);
        }
    }

    return merged;
}

export function useAIDiffEdit() {
    const dispatch = useEditorDispatch();
    const state = useEditorState();
    const activeFile = useActiveFile();

    // Check if a diff tab is currently open
    const hasDiffTab = state.openFiles.some(f => f.viewMode === 'diff');

    const requestEdit = useCallback(async (
        prompt: string,
        provider: 'claude' | 'openai',
        model: string,
        requestId?: string
    ): Promise<{ hunkCount: number; summary: string }> => {
        if (!activeFile) {
            throw new Error('No active file');
        }

        const messages = [{
            role: 'user' as const,
            content: formatEditRequest(prompt, activeFile.content, activeFile.name),
        }];

        const response = await window.electronAPI.aiEditRequest(messages, model, provider, requestId);

        if (!response.success || !response.modifiedContent) {
            throw new Error(response.error || 'Edit request failed');
        }

        // Check if content actually changed (normalize for comparison)
        const normalizedOriginal = activeFile.content.replace(/\r\n/g, '\n');
        const normalizedModified = response.modifiedContent.replace(/\r\n/g, '\n');
        if (normalizedModified === normalizedOriginal) {
            throw new Error('No changes detected in AI response');
        }

        // Compute diffs between original and AI-modified content
        const hunks = computeDiffHunks(activeFile.content, response.modifiedContent);

        if (hunks.length === 0) {
            throw new Error('No changes detected in AI response');
        }

        // Open a new diff tab
        dispatch({
            type: 'OPEN_DIFF_TAB',
            payload: {
                sourceFileId: activeFile.id,
                originalContent: activeFile.content,
                modifiedContent: response.modifiedContent,
                hunks,
                summary: response.summary,
            },
        });

        return { hunkCount: hunks.length, summary: response.summary || 'Changes applied' };
    }, [activeFile, dispatch]);

    return {
        hasDiffTab,
        requestEdit,
    };
}
