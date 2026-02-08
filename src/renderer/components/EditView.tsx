import React, { useCallback, useRef } from 'react';
import { useActiveFile, useEditorDispatch } from '../contexts';
import { useContentEditable } from '../hooks/useContentEditable';
import { useEditorKeyboard } from '../hooks/useEditorKeyboard';
import { useImagePaste } from '../hooks/useImagePaste';
import { useFindReplace } from '../hooks/useFindReplace';
import { renderDiffContent } from '../utils/diffRenderer';
import { getPlainText, getCursorPosition, setPlainText, clearWordHighlights } from '../utils/domUtils';
import { EditorContainer, EditorWrapper, ContentEditableDiv } from '../styles/editor.styles';
import { MarkdownToolbar } from './MarkdownToolbar';
import { RstToolbar } from './RstToolbar';
import { FindReplaceDialog } from './FindReplaceDialog';
import { DiffNavigationToolbar } from './DiffNavigationToolbar';
import { useAIDiffEdit } from '../hooks/useAIDiffEdit';

export function EditView() {
    const activeFile = useActiveFile();
    const dispatch = useEditorDispatch();
    const scrollThrottleRef = useRef<NodeJS.Timeout | null>(null);

    const {
        diffSession,
        currentHunk,
        pendingCount,
        acceptHunk,
        rejectHunk,
        acceptAll,
        navigateToHunk,
        cancelSession,
    } = useAIDiffEdit();

    const {
        contentEditableRef,
        isUserInputRef,
        handleContentChange,
        handleUndo,
        handleRedo,
        handleClick,
        handleDoubleClick,
        handleMarkdownInsert,
        insertTextAtCursor,
    } = useContentEditable();

    const { handleKeyDown } = useEditorKeyboard(
        contentEditableRef,
        handleUndo,
        handleRedo,
        handleMarkdownInsert,
    );

    const { handlePaste, handleDragOver, handleDrop } = useImagePaste(insertTextAtCursor);

    // A dummy previewRef for useFindReplace (not used in edit mode but needed by the hook)
    const previewRef = useRef<HTMLDivElement>(null);

    const {
        findDialogOpen,
        searchQuery,
        searchMatches,
        currentSearchIndex,
        matchCount,
        replaceQuery,
        activeDialogTab,
        setActiveDialogTab,
        setReplaceQuery,
        handleSearchQueryChange,
        handleFindNext,
        handleCount,
        handleReplace,
        handleReplaceAll,
        handleOpenFind,
        handleCloseFind,
    } = useFindReplace(contentEditableRef, previewRef);

    // Throttled scroll position update
    const handleScrollThrottled = useCallback((scrollTop: number) => {
        if (!activeFile) return;
        if (scrollThrottleRef.current) {
            clearTimeout(scrollThrottleRef.current);
        }
        scrollThrottleRef.current = setTimeout(() => {
            dispatch({
                type: 'UPDATE_SCROLL_POSITION',
                payload: { id: activeFile.id, scrollPosition: scrollTop }
            });
        }, 100);
    }, [activeFile, dispatch]);

    // Sync activeFile content to contenteditable when it changes programmatically
    React.useEffect(() => {
        if (isUserInputRef.current) {
            isUserInputRef.current = false;
            return;
        }
        if (!activeFile || !contentEditableRef.current) return;
        if (activeFile.viewMode !== 'edit') return;

        const currentText = getPlainText(contentEditableRef.current);
        if (currentText !== activeFile.content) {
            clearWordHighlights(contentEditableRef.current);
            const cursorPos = getCursorPosition(contentEditableRef.current);
            setPlainText(contentEditableRef.current, activeFile.content, cursorPos);
        }
    }, [activeFile?.content, activeFile?.viewMode, activeFile, contentEditableRef, isUserInputRef]);

    // Initialize contenteditable when switching to edit mode
    React.useEffect(() => {
        if (!activeFile || activeFile.viewMode !== 'edit' || !contentEditableRef.current) return;
        const currentText = getPlainText(contentEditableRef.current);
        if (currentText !== activeFile.content) {
            clearWordHighlights(contentEditableRef.current);
            contentEditableRef.current.textContent = activeFile.content;
        }
    }, [activeFile?.viewMode, activeFile?.id, activeFile, contentEditableRef]);

    // Restore scroll position
    React.useEffect(() => {
        if (!activeFile) return;
        const element = contentEditableRef.current;
        if (element && activeFile.scrollPosition > 0) {
            requestAnimationFrame(() => {
                element.scrollTop = activeFile.scrollPosition;
            });
        }
    }, [activeFile?.id, activeFile?.viewMode, activeFile, contentEditableRef]);

    // Keyboard shortcuts for diff navigation
    React.useEffect(() => {
        if (!diffSession?.isActive) return;

        const handleDiffKeyDown = (e: KeyboardEvent) => {
            const target = e.target as HTMLElement;
            if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) {
                return;
            }

            if (e.key === 'j' || e.key === 'ArrowDown') {
                e.preventDefault();
                if (diffSession.currentHunkIndex < diffSession.hunks.length - 1) {
                    navigateToHunk(diffSession.currentHunkIndex + 1);
                }
                return;
            }

            if (e.key === 'k' || e.key === 'ArrowUp') {
                e.preventDefault();
                if (diffSession.currentHunkIndex > 0) {
                    navigateToHunk(diffSession.currentHunkIndex - 1);
                }
                return;
            }

            if ((e.key === 'Enter' || e.key === 'y') && !e.ctrlKey && !e.shiftKey) {
                e.preventDefault();
                if (currentHunk && currentHunk.status === 'pending') {
                    acceptHunk(currentHunk.id);
                }
                return;
            }

            if ((e.key === 'Backspace' || e.key === 'n') && !e.ctrlKey && !e.shiftKey) {
                e.preventDefault();
                if (currentHunk && currentHunk.status === 'pending') {
                    rejectHunk(currentHunk.id);
                }
                return;
            }

            if (e.key === 'Escape') {
                e.preventDefault();
                cancelSession();
                return;
            }

            if (e.key === 'a' && e.ctrlKey && e.shiftKey) {
                e.preventDefault();
                acceptAll();
                return;
            }
        };

        window.addEventListener('keydown', handleDiffKeyDown);
        return () => window.removeEventListener('keydown', handleDiffKeyDown);
    }, [diffSession, currentHunk, navigateToHunk, acceptHunk, rejectHunk, cancelSession, acceptAll]);

    if (!activeFile) return null;

    const isRstFileEdit = activeFile.fileType === 'rst';
    const EditToolbar = isRstFileEdit ? RstToolbar : MarkdownToolbar;
    const placeholder = isRstFileEdit ? 'Start typing RST...' : 'Start typing markdown...';
    const isDiffActive = diffSession?.isActive && diffSession.fileId === activeFile.id;

    return (
        <EditorContainer>
            <EditToolbar
                mode="edit"
                onInsert={isDiffActive ? undefined : handleMarkdownInsert}
                onUndo={isDiffActive ? undefined : handleUndo}
                onRedo={isDiffActive ? undefined : handleRedo}
                onFind={handleOpenFind}
            />
            <EditorWrapper>
                {isDiffActive ? (
                    <ContentEditableDiv
                        ref={contentEditableRef}
                        contentEditable={false}
                        suppressContentEditableWarning
                        spellCheck={false}
                        dangerouslySetInnerHTML={{ __html: renderDiffContent(diffSession) }}
                        onScroll={(e) => {
                            const target = e.target as HTMLDivElement;
                            handleScrollThrottled(target.scrollTop);
                        }}
                        style={{ cursor: 'default' }}
                    />
                ) : (
                    <ContentEditableDiv
                        ref={contentEditableRef}
                        contentEditable
                        suppressContentEditableWarning
                        data-placeholder={placeholder}
                        onInput={handleContentChange}
                        onKeyDown={handleKeyDown}
                        onClick={handleClick}
                        onDoubleClick={handleDoubleClick}
                        onPaste={handlePaste}
                        onDragOver={handleDragOver}
                        onDrop={handleDrop}
                        spellCheck={false}
                        onScroll={(e) => {
                            const target = e.target as HTMLDivElement;
                            handleScrollThrottled(target.scrollTop);
                        }}
                    />
                )}
                <FindReplaceDialog
                    open={findDialogOpen}
                    mode="edit"
                    activeTab={activeDialogTab}
                    searchQuery={searchQuery}
                    replaceQuery={replaceQuery}
                    matchCount={matchCount}
                    currentMatchIndex={currentSearchIndex}
                    totalMatches={searchMatches.length}
                    onTabChange={setActiveDialogTab}
                    onSearchQueryChange={handleSearchQueryChange}
                    onReplaceQueryChange={setReplaceQuery}
                    onFindNext={handleFindNext}
                    onCount={handleCount}
                    onReplace={handleReplace}
                    onReplaceAll={handleReplaceAll}
                    onClose={handleCloseFind}
                />
                {diffSession?.isActive && diffSession.fileId === activeFile.id && (
                    <DiffNavigationToolbar
                        currentIndex={diffSession.currentHunkIndex}
                        totalCount={diffSession.hunks.length}
                        pendingCount={pendingCount}
                        summary={diffSession.summary}
                        onPrevious={() => navigateToHunk(diffSession.currentHunkIndex - 1)}
                        onNext={() => navigateToHunk(diffSession.currentHunkIndex + 1)}
                        onAcceptCurrent={() => {
                            if (currentHunk) {
                                acceptHunk(currentHunk.id);
                            }
                        }}
                        onRejectCurrent={() => {
                            if (currentHunk) {
                                rejectHunk(currentHunk.id);
                            }
                        }}
                        onAcceptAll={acceptAll}
                        onCancel={cancelSession}
                    />
                )}
            </EditorWrapper>
        </EditorContainer>
    );
}
