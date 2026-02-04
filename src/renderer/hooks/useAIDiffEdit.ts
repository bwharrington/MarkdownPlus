import { useCallback } from 'react';
import { diffLines } from 'diff';
import { useEditorDispatch, useEditorState, useActiveFile } from '../contexts/EditorContext';
import { DiffHunk } from '../types/diffTypes';

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

// Compute diff hunks between original and modified content
function computeDiffHunks(original: string, modified: string): DiffHunk[] {
    const changes = diffLines(original, modified);
    const hunks: DiffHunk[] = [];
    let lineNumber = 0;

    for (let i = 0; i < changes.length; i++) {
        const change = changes[i];
        // Split value into lines, handling the trailing newline carefully
        const lines = change.value.endsWith('\n')
            ? change.value.slice(0, -1).split('\n')
            : change.value.split('\n');

        if (change.added) {
            // Check if previous change was a removal - this might be a modification
            const prevHunk = hunks.length > 0 ? hunks[hunks.length - 1] : null;
            if (prevHunk && prevHunk.type === 'remove' && prevHunk.endLine === lineNumber - 1) {
                // Merge with previous removal to create a 'modify' hunk
                prevHunk.newLines = lines;
                prevHunk.type = 'modify';
            } else {
                hunks.push({
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
            hunks.push({
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

    return hunks;
}

export function useAIDiffEdit() {
    const dispatch = useEditorDispatch();
    const state = useEditorState();
    const activeFile = useActiveFile();

    const requestEdit = useCallback(async (
        prompt: string,
        provider: 'claude' | 'openai',
        model: string
    ): Promise<{ hunkCount: number; summary: string }> => {
        if (!activeFile) {
            throw new Error('No active file');
        }

        const messages = [{
            role: 'user' as const,
            content: formatEditRequest(prompt, activeFile.content, activeFile.name),
        }];

        const response = await window.electronAPI.aiEditRequest(messages, model, provider);

        if (!response.success || !response.modifiedContent) {
            throw new Error(response.error || 'Edit request failed');
        }

        // Check if content actually changed
        if (response.modifiedContent === activeFile.content) {
            throw new Error('No changes detected in AI response');
        }

        // Compute diffs between original and AI-modified content
        const hunks = computeDiffHunks(activeFile.content, response.modifiedContent);

        if (hunks.length === 0) {
            throw new Error('No changes detected in AI response');
        }

        // Start diff session
        dispatch({
            type: 'START_DIFF_SESSION',
            payload: {
                fileId: activeFile.id,
                originalContent: activeFile.content,
                modifiedContent: response.modifiedContent,
                hunks,
                summary: response.summary,
            },
        });

        return { hunkCount: hunks.length, summary: response.summary || 'Changes applied' };
    }, [activeFile, dispatch]);

    const acceptHunk = useCallback((hunkId: string) => {
        dispatch({ type: 'ACCEPT_HUNK', payload: { hunkId } });
    }, [dispatch]);

    const rejectHunk = useCallback((hunkId: string) => {
        dispatch({ type: 'REJECT_HUNK', payload: { hunkId } });
    }, [dispatch]);

    const acceptAll = useCallback(() => {
        dispatch({ type: 'ACCEPT_ALL_HUNKS' });
    }, [dispatch]);

    const navigateToHunk = useCallback((index: number) => {
        if (!state.diffSession) return;
        const clampedIndex = Math.max(0, Math.min(index, state.diffSession.hunks.length - 1));
        dispatch({ type: 'SET_CURRENT_HUNK', payload: { index: clampedIndex } });
    }, [dispatch, state.diffSession]);

    const cancelSession = useCallback(() => {
        dispatch({ type: 'END_DIFF_SESSION' });
    }, [dispatch]);

    // Get pending hunks count
    const pendingCount = state.diffSession?.hunks.filter(h => h.status === 'pending').length ?? 0;

    // Get current hunk
    const currentHunk = state.diffSession && state.diffSession.currentHunkIndex >= 0
        ? state.diffSession.hunks[state.diffSession.currentHunkIndex]
        : null;

    return {
        diffSession: state.diffSession,
        currentHunk,
        pendingCount,
        requestEdit,
        acceptHunk,
        rejectHunk,
        acceptAll,
        navigateToHunk,
        cancelSession,
    };
}
