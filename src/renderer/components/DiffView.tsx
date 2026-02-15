import React, { useEffect, useRef, useMemo, useCallback } from 'react';
import { Box, Typography, IconButton, styled, Tooltip, Chip } from '@mui/material';
import { CheckIcon, UndoIcon } from './AppIcons';
import { DiffNavigationToolbar } from './DiffNavigationToolbar';
import { useEditorDispatch } from '../contexts/EditorContext';
import type { IFile } from '../types';
import type { DiffHunk } from '../types/diffTypes';

/** A single line in the diff output */
interface DiffLine {
    type: 'unchanged' | 'added' | 'removed';
    content: string;
    hunkId: string | null;
    hunkStatus: 'pending' | 'accepted' | 'rejected' | null;
    isFirstLineOfHunk: boolean;
    isCurrentHunk: boolean;
}

/** Build a flat array of DiffLines from the diff session */
function buildDiffLines(
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

// Styled components
const DiffContainer = styled(Box)(({ theme }) => ({
    display: 'flex',
    flexDirection: 'column',
    flex: 1,
    overflow: 'hidden',
}));

const SummaryBanner = styled(Box)(({ theme }) => ({
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    padding: '8px 16px',
    backgroundColor: theme.palette.mode === 'dark' ? 'rgba(33, 150, 243, 0.12)' : 'rgba(33, 150, 243, 0.08)',
    borderBottom: `1px solid ${theme.palette.divider}`,
    flexShrink: 0,
}));

const ScrollContainer = styled(Box)(({ theme }) => ({
    flex: 1,
    overflow: 'auto',
    fontFamily: 'Consolas, Monaco, "Courier New", monospace',
    fontSize: 14,
    lineHeight: 1.6,
    backgroundColor: theme.palette.background.default,
    color: theme.palette.text.primary,
    padding: 16,
    position: 'relative',
}));

const LineRow = styled('div')({
    position: 'relative',
    minHeight: '1.6em',
    whiteSpace: 'pre-wrap',
    wordWrap: 'break-word',
    overflowWrap: 'break-word',
});

const AddedLine = styled(LineRow)(({ theme }) => ({
    backgroundColor: theme.palette.mode === 'dark'
        ? 'rgba(46, 160, 67, 0.25)'
        : 'rgba(46, 160, 67, 0.15)',
    paddingLeft: 16,
    paddingRight: 48,
    borderLeft: '3px solid #2ea043',
}));

const RemovedLine = styled(LineRow)(({ theme }) => ({
    backgroundColor: theme.palette.mode === 'dark'
        ? 'rgba(248, 81, 73, 0.25)'
        : 'rgba(248, 81, 73, 0.15)',
    paddingLeft: 16,
    paddingRight: 48,
    borderLeft: '3px solid #f85149',
    textDecoration: 'line-through',
    opacity: 0.7,
}));

const UnchangedLine = styled(LineRow)({
    paddingLeft: 19, // 16 + 3 to align with bordered lines
});

const CurrentHunkOutline = styled('div')(({ theme }) => ({
    outline: `2px solid ${theme.palette.primary.main}`,
    outlineOffset: 2,
    borderRadius: 2,
}));

const InlineControlContainer = styled(Box)(({ theme }) => ({
    position: 'absolute',
    right: 8,
    top: 0,
    display: 'flex',
    gap: 2,
    backgroundColor: theme.palette.background.paper,
    borderRadius: 4,
    boxShadow: theme.shadows[2],
    padding: 2,
    zIndex: 10,
}));

const AcceptButton = styled(IconButton)(({ theme }) => ({
    padding: 2,
    color: theme.palette.success.main,
    '&:hover': {
        backgroundColor: theme.palette.success.main + '1A',
    },
}));

const RejectButton = styled(IconButton)(({ theme }) => ({
    padding: 2,
    color: theme.palette.error.main,
    '&:hover': {
        backgroundColor: theme.palette.error.main + '1A',
    },
}));

interface DiffViewProps {
    file: IFile;
}

export function DiffView({ file }: DiffViewProps) {
    const dispatch = useEditorDispatch();
    const scrollContainerRef = useRef<HTMLDivElement>(null);
    const diffSession = file.diffSession!;
    const { hunks, currentHunkIndex, summary } = diffSession;

    const pendingHunks = useMemo(() => hunks.filter(h => h.status === 'pending'), [hunks]);
    const pendingCount = pendingHunks.length;

    const diffLines = useMemo(
        () => buildDiffLines(diffSession.originalContent, hunks, currentHunkIndex),
        [diffSession.originalContent, hunks, currentHunkIndex]
    );

    // Accept a single hunk
    const handleAccept = useCallback((hunkId: string) => {
        const updatedHunks = hunks.map(h =>
            h.id === hunkId ? { ...h, status: 'accepted' as const } : h
        );
        dispatch({ type: 'UPDATE_DIFF_SESSION', payload: { diffTabId: file.id, hunks: updatedHunks } });
    }, [hunks, file.id, dispatch]);

    // Reject a single hunk
    const handleReject = useCallback((hunkId: string) => {
        const updatedHunks = hunks.map(h =>
            h.id === hunkId ? { ...h, status: 'rejected' as const } : h
        );
        dispatch({ type: 'UPDATE_DIFF_SESSION', payload: { diffTabId: file.id, hunks: updatedHunks } });
    }, [hunks, file.id, dispatch]);

    // Accept all pending hunks
    const handleAcceptAll = useCallback(() => {
        const updatedHunks = hunks.map(h =>
            h.status === 'pending' ? { ...h, status: 'accepted' as const } : h
        );
        dispatch({ type: 'UPDATE_DIFF_SESSION', payload: { diffTabId: file.id, hunks: updatedHunks } });
    }, [hunks, file.id, dispatch]);

    // Navigate to a specific hunk
    const navigateToHunk = useCallback((index: number) => {
        const clampedIndex = Math.max(0, Math.min(index, hunks.length - 1));
        dispatch({
            type: 'UPDATE_DIFF_SESSION',
            payload: { diffTabId: file.id, hunks, currentHunkIndex: clampedIndex },
        });
    }, [hunks, file.id, dispatch]);

    // Close diff tab (cancel)
    const handleCancel = useCallback(() => {
        dispatch({ type: 'CLOSE_DIFF_TAB', payload: { diffTabId: file.id } });
    }, [file.id, dispatch]);

    // Accept/reject current hunk helpers
    const handleAcceptCurrent = useCallback(() => {
        const currentHunk = hunks[currentHunkIndex];
        if (currentHunk?.status === 'pending') {
            handleAccept(currentHunk.id);
        }
    }, [hunks, currentHunkIndex, handleAccept]);

    const handleRejectCurrent = useCallback(() => {
        const currentHunk = hunks[currentHunkIndex];
        if (currentHunk?.status === 'pending') {
            handleReject(currentHunk.id);
        }
    }, [hunks, currentHunkIndex, handleReject]);

    // Keyboard navigation
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            // Don't handle if typing in an input
            const target = e.target as HTMLElement;
            if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.contentEditable === 'true') {
                return;
            }

            switch (e.key) {
                case 'j':
                case 'ArrowDown':
                    e.preventDefault();
                    navigateToHunk(currentHunkIndex + 1);
                    break;
                case 'k':
                case 'ArrowUp':
                    e.preventDefault();
                    navigateToHunk(currentHunkIndex - 1);
                    break;
                case 'Enter':
                case 'y':
                    e.preventDefault();
                    handleAcceptCurrent();
                    break;
                case 'Backspace':
                case 'n':
                    e.preventDefault();
                    handleRejectCurrent();
                    break;
                case 'Escape':
                    e.preventDefault();
                    handleCancel();
                    break;
                case 'A':
                    if (e.ctrlKey && e.shiftKey) {
                        e.preventDefault();
                        handleAcceptAll();
                    }
                    break;
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [currentHunkIndex, navigateToHunk, handleAcceptCurrent, handleRejectCurrent, handleCancel, handleAcceptAll]);

    // Auto-scroll to current hunk when it changes
    useEffect(() => {
        if (currentHunkIndex < 0 || !scrollContainerRef.current) return;
        const currentHunk = hunks[currentHunkIndex];
        if (!currentHunk) return;

        const el = scrollContainerRef.current.querySelector(`[data-hunk-id="${currentHunk.id}"]`);
        if (el) {
            el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
    }, [currentHunkIndex, hunks]);

    // Group consecutive lines by hunk for outline rendering
    const renderLines = () => {
        const elements: React.ReactNode[] = [];
        let i = 0;

        while (i < diffLines.length) {
            const line = diffLines[i];

            if (line.hunkId && line.hunkStatus === 'pending') {
                // Collect all lines for this hunk
                const hunkId = line.hunkId;
                const hunkLines: DiffLine[] = [];
                while (i < diffLines.length && diffLines[i].hunkId === hunkId) {
                    hunkLines.push(diffLines[i]);
                    i++;
                }

                const isCurrent = hunkLines[0]?.isCurrentHunk;
                const Wrapper = isCurrent ? CurrentHunkOutline : React.Fragment;
                const wrapperProps = isCurrent ? { 'data-hunk-id': hunkId } : {};

                elements.push(
                    <Wrapper key={`hunk-${hunkId}`} {...wrapperProps}>
                        {!isCurrent && <div data-hunk-id={hunkId} />}
                        {hunkLines.map((hl, idx) => {
                            const LineComponent = hl.type === 'added' ? AddedLine
                                : hl.type === 'removed' ? RemovedLine
                                : UnchangedLine;

                            return (
                                <LineComponent key={`${hunkId}-${idx}`}>
                                    {hl.content || '\u00A0'}
                                    {hl.isFirstLineOfHunk && (
                                        <InlineControlContainer>
                                            <Tooltip title="Keep this change (Enter)">
                                                <AcceptButton
                                                    size="small"
                                                    onClick={() => handleAccept(hunkId)}
                                                >
                                                    <CheckIcon fontSize="small" />
                                                </AcceptButton>
                                            </Tooltip>
                                            <Tooltip title="Undo this change (Backspace)">
                                                <RejectButton
                                                    size="small"
                                                    onClick={() => handleReject(hunkId)}
                                                >
                                                    <UndoIcon fontSize="small" />
                                                </RejectButton>
                                            </Tooltip>
                                        </InlineControlContainer>
                                    )}
                                </LineComponent>
                            );
                        })}
                    </Wrapper>
                );
            } else {
                // Unchanged line
                elements.push(
                    <UnchangedLine key={`line-${i}`}>
                        {line.content || '\u00A0'}
                    </UnchangedLine>
                );
                i++;
            }
        }

        return elements;
    };

    return (
        <DiffContainer>
            {/* Summary banner */}
            {summary && (
                <SummaryBanner>
                    <Typography variant="body2" sx={{ fontWeight: 500, flex: 1 }}>
                        {summary}
                    </Typography>
                    <Chip
                        label={`${pendingCount} pending`}
                        size="small"
                        color={pendingCount > 0 ? 'primary' : 'success'}
                    />
                </SummaryBanner>
            )}

            {/* Diff content */}
            <ScrollContainer ref={scrollContainerRef}>
                {renderLines()}
            </ScrollContainer>

            {/* Navigation toolbar */}
            {pendingCount > 0 && (
                <DiffNavigationToolbar
                    currentIndex={currentHunkIndex}
                    totalCount={hunks.length}
                    pendingCount={pendingCount}
                    summary={summary}
                    onPrevious={() => navigateToHunk(currentHunkIndex - 1)}
                    onNext={() => navigateToHunk(currentHunkIndex + 1)}
                    onAcceptCurrent={handleAcceptCurrent}
                    onRejectCurrent={handleRejectCurrent}
                    onAcceptAll={handleAcceptAll}
                    onCancel={handleCancel}
                />
            )}
        </DiffContainer>
    );
}
