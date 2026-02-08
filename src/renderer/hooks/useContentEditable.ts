import React, { useCallback, useRef, useState } from 'react';
import { useActiveFile, useEditorDispatch } from '../contexts';
import {
    getPlainText,
    setPlainText,
    getCursorPosition,
    setCursorPosition,
    clearWordHighlights,
    highlightWordInElement,
} from '../utils/domUtils';

export interface ContentEditableReturn {
    contentEditableRef: React.RefObject<HTMLDivElement | null>;
    lastContentRef: React.MutableRefObject<string>;
    undoTimeoutRef: React.MutableRefObject<NodeJS.Timeout | null>;
    isUserInputRef: React.MutableRefObject<boolean>;
    highlightedMatches: Array<{ start: number; end: number }>;
    currentMatchIndex: number;
    handleContentChange: () => void;
    handleUndo: () => void;
    handleRedo: () => void;
    handleClick: () => void;
    handleDoubleClick: () => void;
    handleMarkdownInsert: (before: string, after: string, placeholder?: string) => void;
    insertTextAtCursor: (text: string) => void;
}

/**
 * Hook that manages contenteditable interaction logic including:
 * - Content change tracking with undo/redo debouncing
 * - Word highlighting on double-click
 * - Markdown insertion
 * - Text insertion at cursor
 */
export function useContentEditable(): ContentEditableReturn {
    const activeFile = useActiveFile();
    const dispatch = useEditorDispatch();
    const contentEditableRef = useRef<HTMLDivElement>(null);
    const lastContentRef = useRef<string>('');
    const undoTimeoutRef = useRef<NodeJS.Timeout | null>(null);
    const isUserInputRef = useRef<boolean>(false);
    const highlightedMatchesRef = useRef<Array<{ start: number; end: number }>>([]);
    const [highlightedMatches, setHighlightedMatches] = useState<Array<{ start: number; end: number }>>([]);
    const [currentMatchIndex, setCurrentMatchIndex] = useState<number>(0);

    // Keep ref in sync with state for use in callbacks without causing re-renders
    highlightedMatchesRef.current = highlightedMatches;

    // Stable reference to activeFile.id to avoid callback recreation
    const activeFileIdRef = useRef<string | null>(null);
    activeFileIdRef.current = activeFile?.id ?? null;

    const handleContentChange = useCallback(() => {
        const fileId = activeFileIdRef.current;
        if (fileId && contentEditableRef.current) {
            // Mark this as user input to prevent sync useEffect from running
            isUserInputRef.current = true;

            const newContent = getPlainText(contentEditableRef.current);

            // Only clear word highlights if there are any (avoid unnecessary DOM operations)
            if (highlightedMatchesRef.current.length > 0) {
                clearWordHighlights(contentEditableRef.current);
                setHighlightedMatches([]);
                setCurrentMatchIndex(0);
            }

            dispatch({
                type: 'UPDATE_CONTENT',
                payload: { id: fileId, content: newContent },
            });

            // Push to undo stack after a short delay (debounce)
            if (undoTimeoutRef.current) {
                clearTimeout(undoTimeoutRef.current);
            }
            undoTimeoutRef.current = setTimeout(() => {
                if (lastContentRef.current !== newContent) {
                    dispatch({
                        type: 'PUSH_UNDO',
                        payload: { id: fileId, content: newContent },
                    });
                    lastContentRef.current = newContent;
                }
            }, 500);
        }
    }, [dispatch]);

    const handleUndo = useCallback(() => {
        const fileId = activeFileIdRef.current;
        if (fileId) {
            dispatch({
                type: 'UNDO',
                payload: { id: fileId },
            });
        }
    }, [dispatch]);

    const handleRedo = useCallback(() => {
        const fileId = activeFileIdRef.current;
        if (fileId) {
            dispatch({
                type: 'REDO',
                payload: { id: fileId },
            });
        }
    }, [dispatch]);

    const handleDoubleClick = useCallback(() => {
        if (!activeFileIdRef.current || !contentEditableRef.current) return;

        const element = contentEditableRef.current;
        const selection = window.getSelection();
        if (!selection) return;

        // Get the selected word (browser automatically selects on double-click)
        const selectedText = selection.toString().trim();
        if (!selectedText || !/^[a-zA-Z0-9]+$/.test(selectedText)) return;

        const text = getPlainText(element);

        // Find all matches of the selected word using regex word boundaries
        const matches: Array<{ start: number; end: number }> = [];
        const regex = new RegExp(`\\b${selectedText}\\b`, 'g');
        let match;

        while ((match = regex.exec(text)) !== null) {
            matches.push({
                start: match.index,
                end: match.index + selectedText.length,
            });
        }

        if (matches.length > 0) {
            const position = getCursorPosition(element);

            // Find which match was clicked
            const clickedIndex = matches.findIndex(m => position >= m.start && position <= m.end);
            const clickedMatch = clickedIndex >= 0 ? matches[clickedIndex] : matches[0];

            // Clear existing highlights
            clearWordHighlights(element);

            // Highlight all matches using the same function as preview mode
            highlightWordInElement(element, selectedText);

            // Store match info for state tracking
            setHighlightedMatches(matches);
            setCurrentMatchIndex(clickedIndex >= 0 ? clickedIndex : 0);

            // Restore the word selection after highlighting
            requestAnimationFrame(() => {
                // Re-select the word to maintain selection
                const range = document.createRange();
                const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT, null);

                let currentOffset = 0;
                let node;
                let startNode: Node | null = null;
                let startOffset = 0;
                let endNode: Node | null = null;
                let endOffset = 0;

                while ((node = walker.nextNode())) {
                    const nodeLength = node.textContent?.length || 0;

                    if (!startNode && currentOffset + nodeLength > clickedMatch.start) {
                        startNode = node;
                        startOffset = clickedMatch.start - currentOffset;
                    }

                    if (currentOffset + nodeLength >= clickedMatch.end) {
                        endNode = node;
                        endOffset = clickedMatch.end - currentOffset;
                        break;
                    }

                    currentOffset += nodeLength;
                }

                if (startNode && endNode) {
                    range.setStart(startNode, startOffset);
                    range.setEnd(endNode, endOffset);
                    selection.removeAllRanges();
                    selection.addRange(range);
                }

                element.focus();
            });
        } else {
            setHighlightedMatches([]);
            setCurrentMatchIndex(0);
        }
    }, []);

    const handleClick = useCallback(() => {
        // Clear highlights on single click
        if (highlightedMatchesRef.current.length > 0 && contentEditableRef.current) {
            clearWordHighlights(contentEditableRef.current);
            setHighlightedMatches([]);
            setCurrentMatchIndex(0);
        }
    }, []);

    const handleMarkdownInsert = useCallback((before: string, after: string, placeholder?: string) => {
        const fileId = activeFileIdRef.current;
        if (!fileId || !contentEditableRef.current) return;

        const element = contentEditableRef.current;
        const selection = window.getSelection();

        if (!selection || selection.rangeCount === 0) {
            // No selection, insert at the end
            const text = getPlainText(element);
            const textToInsert = placeholder || '';
            const newText = before + textToInsert + after;
            const newContent = text + newText;

            setPlainText(element, newContent, text.length + before.length + textToInsert.length);

            dispatch({
                type: 'UPDATE_CONTENT',
                payload: { id: fileId, content: newContent },
            });
            dispatch({
                type: 'PUSH_UNDO',
                payload: { id: fileId, content: newContent },
            });
            return;
        }

        const range = selection.getRangeAt(0);
        const selectedText = range.toString();
        const textToInsert = selectedText || placeholder || '';

        const newText = before + textToInsert + after;

        // Clear highlights before inserting
        clearWordHighlights(element);

        // Delete selected content and insert new text
        range.deleteContents();
        const textNode = document.createTextNode(newText);
        range.insertNode(textNode);

        // Position cursor after inserted text
        const newRange = document.createRange();
        newRange.setStartAfter(textNode);
        newRange.collapse(true);
        selection.removeAllRanges();
        selection.addRange(newRange);

        // Update state
        const newContent = getPlainText(element);
        dispatch({
            type: 'UPDATE_CONTENT',
            payload: { id: fileId, content: newContent },
        });
        dispatch({
            type: 'PUSH_UNDO',
            payload: { id: fileId, content: newContent },
        });

        element.focus();
    }, [dispatch]);

    // Helper to insert text at cursor and update state
    const insertTextAtCursor = useCallback((text: string) => {
        const fileId = activeFileIdRef.current;
        if (!fileId || !contentEditableRef.current) return;

        const selection = window.getSelection();
        if (selection && selection.rangeCount > 0) {
            const range = selection.getRangeAt(0);
            range.deleteContents();
            range.insertNode(document.createTextNode(text));
            range.collapse(false);
            selection.removeAllRanges();
            selection.addRange(range);
        }

        const newContent = getPlainText(contentEditableRef.current);
        dispatch({
            type: 'UPDATE_CONTENT',
            payload: { id: fileId, content: newContent },
        });
        dispatch({
            type: 'PUSH_UNDO',
            payload: { id: fileId, content: newContent },
        });
    }, [dispatch]);

    return {
        contentEditableRef,
        lastContentRef,
        undoTimeoutRef,
        isUserInputRef,
        highlightedMatches,
        currentMatchIndex,
        handleContentChange,
        handleUndo,
        handleRedo,
        handleClick,
        handleDoubleClick,
        handleMarkdownInsert,
        insertTextAtCursor,
    };
}
