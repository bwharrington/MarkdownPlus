import React, { useEffect, useRef, useMemo, useCallback } from 'react';
import { Box, Typography, IconButton, styled, Tooltip, Chip } from '@mui/material';
import { CheckIcon, UndoIcon } from './AppIcons';
import { DiffNavigationToolbar } from './DiffNavigationToolbar';
import { useEditorDispatch } from '../contexts/EditorContext';
import type { IFile } from '../types';
import type { DiffHunk } from '../types/diffTypes';
import { buildDiffLines } from '../utils/diffUtils';
import type { DiffLine } from '../utils/diffUtils';

// Styled components
const DiffContainer = styled(Box)(({ theme }) => ({
    display: 'flex',
    flexDirection: 'column',
    flex: 1,
    overflow: 'hidden',
    position: 'relative',
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

    // Find the next pending hunk index starting from a given index
    const findNextPendingIndex = useCallback((fromIndex: number, updatedHunks: DiffHunk[]) => {
        // Search forward from fromIndex
        for (let i = fromIndex; i < updatedHunks.length; i++) {
            if (updatedHunks[i].status === 'pending') return i;
        }
        // Wrap around: search from start
        for (let i = 0; i < fromIndex; i++) {
            if (updatedHunks[i].status === 'pending') return i;
        }
        return -1;
    }, []);

    // Find the previous pending hunk index
    const findPrevPendingIndex = useCallback((fromIndex: number, hunkList: DiffHunk[]) => {
        for (let i = fromIndex; i >= 0; i--) {
            if (hunkList[i].status === 'pending') return i;
        }
        // Wrap around: search from end
        for (let i = hunkList.length - 1; i > fromIndex; i--) {
            if (hunkList[i].status === 'pending') return i;
        }
        return -1;
    }, []);

    // Accept a single hunk and auto-advance to next pending
    const handleAccept = useCallback((hunkId: string) => {
        const updatedHunks = hunks.map(h =>
            h.id === hunkId ? { ...h, status: 'accepted' as const } : h
        );
        const resolvedIndex = hunks.findIndex(h => h.id === hunkId);
        const nextIndex = findNextPendingIndex(resolvedIndex, updatedHunks);
        dispatch({ type: 'UPDATE_DIFF_SESSION', payload: { diffTabId: file.id, hunks: updatedHunks, currentHunkIndex: nextIndex >= 0 ? nextIndex : currentHunkIndex } });
    }, [hunks, file.id, dispatch, currentHunkIndex, findNextPendingIndex]);

    // Reject a single hunk and auto-advance to next pending
    const handleReject = useCallback((hunkId: string) => {
        const updatedHunks = hunks.map(h =>
            h.id === hunkId ? { ...h, status: 'rejected' as const } : h
        );
        const resolvedIndex = hunks.findIndex(h => h.id === hunkId);
        const nextIndex = findNextPendingIndex(resolvedIndex, updatedHunks);
        dispatch({ type: 'UPDATE_DIFF_SESSION', payload: { diffTabId: file.id, hunks: updatedHunks, currentHunkIndex: nextIndex >= 0 ? nextIndex : currentHunkIndex } });
    }, [hunks, file.id, dispatch, currentHunkIndex, findNextPendingIndex]);

    // Accept all pending hunks
    const handleAcceptAll = useCallback(() => {
        const updatedHunks = hunks.map(h =>
            h.status === 'pending' ? { ...h, status: 'accepted' as const } : h
        );
        dispatch({ type: 'UPDATE_DIFF_SESSION', payload: { diffTabId: file.id, hunks: updatedHunks } });
    }, [hunks, file.id, dispatch]);

    // Navigate to next pending hunk
    const navigateToNextPending = useCallback(() => {
        const nextIndex = findNextPendingIndex(currentHunkIndex + 1, hunks);
        if (nextIndex >= 0) {
            dispatch({
                type: 'UPDATE_DIFF_SESSION',
                payload: { diffTabId: file.id, hunks, currentHunkIndex: nextIndex },
            });
        }
    }, [hunks, file.id, dispatch, currentHunkIndex, findNextPendingIndex]);

    // Navigate to previous pending hunk
    const navigateToPrevPending = useCallback(() => {
        const prevIndex = findPrevPendingIndex(currentHunkIndex - 1, hunks);
        if (prevIndex >= 0) {
            dispatch({
                type: 'UPDATE_DIFF_SESSION',
                payload: { diffTabId: file.id, hunks, currentHunkIndex: prevIndex },
            });
        }
    }, [hunks, file.id, dispatch, currentHunkIndex, findPrevPendingIndex]);

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
                    navigateToNextPending();
                    break;
                case 'k':
                case 'ArrowUp':
                    e.preventDefault();
                    navigateToPrevPending();
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
    }, [currentHunkIndex, navigateToNextPending, navigateToPrevPending, handleAcceptCurrent, handleRejectCurrent, handleCancel, handleAcceptAll]);

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
                    onPrevious={navigateToPrevPending}
                    onNext={navigateToNextPending}
                    onAcceptCurrent={handleAcceptCurrent}
                    onRejectCurrent={handleRejectCurrent}
                    onAcceptAll={handleAcceptAll}
                    onCancel={handleCancel}
                />
            )}
        </DiffContainer>
    );
}
