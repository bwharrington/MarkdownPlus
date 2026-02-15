import React, { useCallback, useRef } from 'react';
import { useActiveFile, useEditorDispatch } from '../contexts';
import { useContentEditable } from '../hooks/useContentEditable';
import { useEditorKeyboard } from '../hooks/useEditorKeyboard';
import { useImagePaste } from '../hooks/useImagePaste';
import { useFindReplace } from '../hooks/useFindReplace';
import { getPlainText, getCursorPosition, setPlainText, clearWordHighlights } from '../utils/domUtils';
import { EditorContainer, EditorWrapper, ContentEditableDiv } from '../styles/editor.styles';
import { MarkdownToolbar } from './MarkdownToolbar';
import { RstToolbar } from './RstToolbar';
import { FindReplaceDialog } from './FindReplaceDialog';
import { buildPdfHtmlDocument } from '../utils/pdfExport';
import { useHasDiffTab } from '../contexts/EditorContext';

export function EditView() {
    const activeFile = useActiveFile();
    const dispatch = useEditorDispatch();
    const scrollThrottleRef = useRef<NodeJS.Timeout | null>(null);

    // Check if this file has an open diff tab (make it read-only if so)
    const hasDiffForThisFile = useHasDiffTab(activeFile?.id);

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

    if (!activeFile) return null;

    const isRstFileEdit = activeFile.fileType === 'rst';
    const EditToolbar = isRstFileEdit ? RstToolbar : MarkdownToolbar;
    const placeholder = isRstFileEdit ? 'Start typing RST...' : 'Start typing markdown...';

    const handleExportPdf = useCallback(async () => {
        if (!activeFile) return;

        const defaultName = activeFile.name.replace(/\.[^.]+$/, '') || 'Untitled';
        const exportHtml = await buildPdfHtmlDocument({
            fileType: activeFile.fileType,
            content: activeFile.content || '',
            documentPath: activeFile.path,
            title: activeFile.name,
        });

        const result = await window.electronAPI.exportPdf(exportHtml, `${defaultName}.pdf`);
        if (!result || result.cancelled) {
            return;
        }

        if (result.success) {
            const outputName = result.filePath?.split(/[\\/]/).pop() || `${defaultName}.pdf`;
            dispatch({
                type: 'SHOW_NOTIFICATION',
                payload: { message: `Exported "${outputName}"`, severity: 'success' },
            });
        } else {
            dispatch({
                type: 'SHOW_NOTIFICATION',
                payload: { message: `Failed to export "${activeFile.name}"`, severity: 'error' },
            });
        }
    }, [activeFile, dispatch]);

    return (
        <EditorContainer>
            <EditToolbar
                mode="edit"
                onInsert={hasDiffForThisFile ? undefined : handleMarkdownInsert}
                onUndo={hasDiffForThisFile ? undefined : handleUndo}
                onRedo={hasDiffForThisFile ? undefined : handleRedo}
                onFind={handleOpenFind}
                onExportPdf={handleExportPdf}
            />
            <EditorWrapper>
                <ContentEditableDiv
                    ref={contentEditableRef}
                    contentEditable={!hasDiffForThisFile}
                    suppressContentEditableWarning
                    data-placeholder={placeholder}
                    onInput={hasDiffForThisFile ? undefined : handleContentChange}
                    onKeyDown={hasDiffForThisFile ? undefined : handleKeyDown}
                    onClick={hasDiffForThisFile ? undefined : handleClick}
                    onDoubleClick={hasDiffForThisFile ? undefined : handleDoubleClick}
                    onPaste={hasDiffForThisFile ? undefined : handlePaste}
                    onDragOver={hasDiffForThisFile ? undefined : handleDragOver}
                    onDrop={hasDiffForThisFile ? undefined : handleDrop}
                    spellCheck={false}
                    onScroll={(e) => {
                        const target = e.target as HTMLDivElement;
                        handleScrollThrottled(target.scrollTop);
                    }}
                    style={hasDiffForThisFile ? { cursor: 'default', opacity: 0.7 } : undefined}
                />
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
            </EditorWrapper>
        </EditorContainer>
    );
}
