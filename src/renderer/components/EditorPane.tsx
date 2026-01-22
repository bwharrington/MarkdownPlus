import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Box, styled } from '@mui/material';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { useActiveFile, useEditorDispatch } from '../contexts';
import { MarkdownToolbar } from './MarkdownToolbar';
import { FindReplaceDialog } from './FindReplaceDialog';

const EditorContainer = styled(Box)({
    display: 'flex',
    flexDirection: 'column',
    flex: 1,
    overflow: 'hidden',
});

const ContentEditableDiv = styled('div')(({ theme }) => ({
    flex: 1,
    padding: 16,
    margin: 0,
    border: 'none',
    outline: 'none',
    fontFamily: 'Consolas, Monaco, "Courier New", monospace',
    fontSize: 14,
    lineHeight: 1.6,
    backgroundColor: theme.palette.background.default,
    color: theme.palette.text.primary,
    whiteSpace: 'pre-wrap',
    wordWrap: 'break-word',
    overflowWrap: 'break-word',
    overflow: 'auto',
    '&[contenteditable]:empty:before': {
        content: 'attr(data-placeholder)',
        color: theme.palette.text.secondary,
        pointerEvents: 'none',
    },
    '& .word-highlight': {
        backgroundColor: theme.palette.mode === 'dark' ? 'rgba(144, 238, 144, 0.3)' : 'rgba(144, 238, 144, 0.7)',
        borderRadius: 2,
    },
    '& .search-highlight': {
        backgroundColor: theme.palette.mode === 'dark' ? 'rgba(144, 238, 144, 0.3)' : 'rgba(144, 238, 144, 0.7)',
        borderRadius: 2,
    },
    '& .current-match': {
        backgroundColor: theme.palette.mode === 'dark' ? 'rgba(255, 152, 0, 0.5)' : 'rgba(255, 152, 0, 0.6)',
        borderRadius: 2,
    },
    '& .current-line-highlight': {
        backgroundColor: theme.palette.mode === 'dark' ? 'rgba(33, 150, 243, 0.15)' : 'rgba(33, 150, 243, 0.1)',
        display: 'block',
    },
}));

const EditorWrapper = styled(Box)({
    display: 'flex',
    flexDirection: 'column',
    flex: 1,
    overflow: 'hidden',
    position: 'relative',
});

const MarkdownPreview = styled(Box)(({ theme }) => ({
    flex: 1,
    padding: 16,
    overflow: 'auto',
    backgroundColor: theme.palette.background.default,
    color: theme.palette.text.primary,
    '& h1, & h2, & h3, & h4, & h5, & h6': {
        marginTop: 16,
        marginBottom: 8,
        fontWeight: 600,
    },
    '& h1': { fontSize: '2em' },
    '& h2': { fontSize: '1.5em', borderBottom: `1px solid ${theme.palette.divider}`, paddingBottom: 8 },
    '& h3': { fontSize: '1.25em' },
    '& p': { marginBottom: 16 },
    '& code': {
        backgroundColor: theme.palette.action.hover,
        padding: '2px 6px',
        borderRadius: 4,
        fontFamily: 'Consolas, Monaco, "Courier New", monospace',
        fontSize: '0.9em',
    },
    '& pre': {
        backgroundColor: theme.palette.action.hover,
        padding: 16,
        borderRadius: 8,
        overflow: 'auto',
        '& code': {
            backgroundColor: 'transparent',
            padding: 0,
        },
    },
    '& ul, & ol': {
        paddingLeft: 24,
        marginBottom: 16,
    },
    '& li': {
        marginBottom: 4,
    },
    '& blockquote': {
        borderLeft: `4px solid ${theme.palette.primary.main}`,
        marginLeft: 0,
        paddingLeft: 16,
        color: theme.palette.text.secondary,
    },
    '& a': {
        color: theme.palette.primary.main,
    },
    '& table': {
        borderCollapse: 'collapse',
        width: '100%',
        marginBottom: 16,
    },
    '& th, & td': {
        border: `1px solid ${theme.palette.divider}`,
        padding: 8,
        textAlign: 'left',
    },
    '& th': {
        backgroundColor: theme.palette.action.hover,
    },
    '& hr': {
        border: 'none',
        borderTop: `1px solid ${theme.palette.divider}`,
        margin: '24px 0',
    },
    '& img': {
        maxWidth: '100%',
    },
    '& .word-highlight': {
        backgroundColor: theme.palette.mode === 'dark' ? 'rgba(144, 238, 144, 0.3)' : 'rgba(144, 238, 144, 0.7)',
        borderRadius: 2,
    },
    '& .search-highlight': {
        backgroundColor: theme.palette.mode === 'dark' ? 'rgba(144, 238, 144, 0.3)' : 'rgba(144, 238, 144, 0.7)',
        borderRadius: 2,
    },
    '& .current-match': {
        backgroundColor: theme.palette.mode === 'dark' ? 'rgba(255, 152, 0, 0.5)' : 'rgba(255, 152, 0, 0.6)',
        borderRadius: 2,
    },
}));

const SplitContainer = styled(Box)({
    display: 'flex',
    flex: 1,
    overflow: 'hidden',
});

const SplitDivider = styled(Box)(({ theme }) => ({
    width: 4,
    backgroundColor: theme.palette.divider,
    cursor: 'col-resize',
    '&:hover': {
        backgroundColor: theme.palette.primary.main,
    },
}));

// Utility function to highlight all instances of a word in a DOM element
function highlightWordInElement(element: HTMLElement, word: string): void {
    const regex = new RegExp(`\\b(${word})\\b`, 'gi');

    // Recursively process text nodes
    const processNode = (node: Node) => {
        if (node.nodeType === Node.TEXT_NODE && node.textContent) {
            const text = node.textContent;
            if (regex.test(text)) {
                // Reset regex index
                regex.lastIndex = 0;

                // Create a span to replace the text node with highlighted content
                const span = document.createElement('span');
                let lastIndex = 0;
                let match;

                while ((match = regex.exec(text)) !== null) {
                    // Add text before match
                    if (match.index > lastIndex) {
                        span.appendChild(document.createTextNode(text.substring(lastIndex, match.index)));
                    }

                    // Add highlighted match
                    const highlight = document.createElement('span');
                    highlight.className = 'word-highlight';
                    highlight.textContent = match[0];
                    span.appendChild(highlight);

                    lastIndex = match.index + match[0].length;
                }

                // Add remaining text
                if (lastIndex < text.length) {
                    span.appendChild(document.createTextNode(text.substring(lastIndex)));
                }

                // Replace the text node with the span containing highlights
                node.parentNode?.replaceChild(span, node);
            }
        } else if (node.nodeType === Node.ELEMENT_NODE) {
            // Skip PRE (code blocks), SCRIPT, and STYLE elements, but allow inline CODE
            const el = node as HTMLElement;
            if (!['PRE', 'SCRIPT', 'STYLE'].includes(el.tagName)) {
                // Process child nodes (create array to avoid live collection issues)
                Array.from(node.childNodes).forEach(processNode);
            }
        }
    };

    // Process all child nodes
    Array.from(element.childNodes).forEach(processNode);
}

// Utility function to extract word at position and find all matches
function getWordAtPosition(text: string, position: number): { word: string; matches: Array<{ start: number; end: number }> } | null {
    // Find the word boundaries around the clicked position
    let start = position;
    let end = position;

    // Expand left to find word boundary
    while (start > 0 && /[a-zA-Z0-9]/.test(text[start - 1])) {
        start--;
    }

    // Expand right to find word boundary
    while (end < text.length && /[a-zA-Z0-9]/.test(text[end])) {
        end++;
    }

    // Extract the word
    const word = text.substring(start, end);

    // If no valid word found, return null
    if (!word || word.length === 0) {
        return null;
    }

    // Find all matches of this word in the text
    const matches: Array<{ start: number; end: number }> = [];
    const regex = new RegExp(`\\b${word}\\b`, 'g');
    let match;

    while ((match = regex.exec(text)) !== null) {
        matches.push({
            start: match.index,
            end: match.index + word.length,
        });
    }

    return { word, matches };
}

// ContentEditable utility functions

// Get current cursor position as character offset
function getCursorPosition(element: HTMLElement): number {
    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0) return 0;

    const range = selection.getRangeAt(0);
    const preRange = range.cloneRange();
    preRange.selectNodeContents(element);
    preRange.setEnd(range.startContainer, range.startOffset);

    return preRange.toString().length;
}

// Set cursor position by character offset
function setCursorPosition(element: HTMLElement, offset: number): void {
    const range = document.createRange();
    const selection = window.getSelection();
    if (!selection) return;

    let currentOffset = 0;
    const walker = document.createTreeWalker(
        element,
        NodeFilter.SHOW_TEXT,
        null
    );

    let node;
    while ((node = walker.nextNode())) {
        const nodeLength = node.textContent?.length || 0;
        if (currentOffset + nodeLength >= offset) {
            range.setStart(node, offset - currentOffset);
            range.collapse(true);
            selection.removeAllRanges();
            selection.addRange(range);
            return;
        }
        currentOffset += nodeLength;
    }

    // If offset is beyond content, place cursor at end
    if (element.lastChild) {
        range.selectNodeContents(element);
        range.collapse(false);
        selection.removeAllRanges();
        selection.addRange(range);
    }
}

// Get plain text content (no HTML tags)
function getPlainText(element: HTMLElement): string {
    return element.textContent || '';
}

// Set plain text content (preserve cursor position if possible)
function setPlainText(element: HTMLElement, text: string, cursorOffset?: number): void {
    const currentOffset = cursorOffset ?? getCursorPosition(element);
    element.textContent = text;
    setCursorPosition(element, Math.min(currentOffset, text.length));
}

// Clear word highlights from element
function clearWordHighlights(element: HTMLElement): void {
    element.querySelectorAll('.word-highlight').forEach(el => {
        const parent = el.parentNode;
        if (parent) {
            parent.replaceChild(document.createTextNode(el.textContent || ''), el);
            parent.normalize();
        }
    });
}

// Clear search-specific highlights (separate from word highlights)
function clearSearchHighlights(element: HTMLElement): void {
    element.querySelectorAll('.search-highlight, .current-match, .current-line-highlight').forEach(el => {
        const parent = el.parentNode;
        if (parent) {
            parent.replaceChild(document.createTextNode(el.textContent || ''), el);
            parent.normalize();
        }
    });
}

// Highlight text at specific range with given class
function highlightTextRange(element: HTMLElement, start: number, end: number, className: string): void {
    const text = element.textContent || '';
    if (start < 0 || end > text.length || start >= end) return;

    // Clear existing search highlights first
    clearSearchHighlights(element);

    // Set the plain text content and then highlight
    element.textContent = text;

    const range = document.createRange();
    const selection = window.getSelection();

    let currentOffset = 0;
    const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT, null);

    let startNode: Node | null = null;
    let startOffset = 0;
    let endNode: Node | null = null;
    let endOffset = 0;

    let node;
    while ((node = walker.nextNode())) {
        const nodeLength = node.textContent?.length || 0;

        // Find start node
        if (!startNode && currentOffset + nodeLength > start) {
            startNode = node;
            startOffset = start - currentOffset;
        }

        // Find end node
        if (currentOffset + nodeLength >= end) {
            endNode = node;
            endOffset = end - currentOffset;
            break;
        }

        currentOffset += nodeLength;
    }

    if (startNode && endNode) {
        range.setStart(startNode, startOffset);
        range.setEnd(endNode, endOffset);

        const highlightSpan = document.createElement('span');
        highlightSpan.className = className;
        range.surroundContents(highlightSpan);

        // Restore selection/cursor
        if (selection) {
            selection.removeAllRanges();
        }
    }
}

export function EditorPane() {
    const activeFile = useActiveFile();
    const dispatch = useEditorDispatch();
    const contentEditableRef = useRef<HTMLDivElement>(null);
    const previewRef = useRef<HTMLDivElement>(null);
    const lastContentRef = useRef<string>('');
    const undoTimeoutRef = useRef<NodeJS.Timeout | null>(null);
    const isUserInputRef = useRef<boolean>(false);
    const scrollThrottleRef = useRef<NodeJS.Timeout | null>(null);
    const highlightedMatchesRef = useRef<Array<{ start: number; end: number }>>([]);
    const [highlightedMatches, setHighlightedMatches] = useState<Array<{ start: number; end: number }>>([]);
    const [currentMatchIndex, setCurrentMatchIndex] = useState<number>(0);

    // Find dialog state
    const [findDialogOpen, setFindDialogOpen] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [searchMatches, setSearchMatches] = useState<Array<{ start: number; end: number }>>([]);
    const [currentSearchIndex, setCurrentSearchIndex] = useState(-1);
    const [matchCount, setMatchCount] = useState<number | null>(null);

    // Replace state
    const [replaceQuery, setReplaceQuery] = useState('');
    const [activeDialogTab, setActiveDialogTab] = useState<'find' | 'replace'>('find');

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
            // Use ref to avoid dependency on highlightedMatches state
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

        const position = getCursorPosition(element);
        const text = getPlainText(element);

        // Get word at position and all matches
        const result = getWordAtPosition(text, position);

        if (result && result.matches.length > 0) {
            // Find which match was clicked
            const clickedIndex = result.matches.findIndex(m => position >= m.start && position <= m.end);
            const clickedMatch = clickedIndex >= 0 ? result.matches[clickedIndex] : result.matches[0];

            // Clear existing highlights
            clearWordHighlights(element);

            // Highlight all matches using the same function as preview mode
            highlightWordInElement(element, result.word);

            // Store match info for state tracking
            setHighlightedMatches(result.matches);
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
        // Use ref to avoid dependency on highlightedMatches state
        if (highlightedMatchesRef.current.length > 0 && contentEditableRef.current) {
            clearWordHighlights(contentEditableRef.current);
            setHighlightedMatches([]);
            setCurrentMatchIndex(0);
        }
    }, []);

    const handlePreviewDoubleClick = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
        if (!activeFileIdRef.current || !previewRef.current) return;

        const selection = window.getSelection();

        if (!selection || selection.rangeCount === 0) return;

        // Get the selected word after double-click (browser automatically selects the word)
        let word = selection.toString().trim();

        // If no selection, try to get word from click position
        if (!word) {
            const range = selection.getRangeAt(0);
            const textNode = range.startContainer;
            if (textNode.nodeType === Node.TEXT_NODE && textNode.textContent) {
                const text = textNode.textContent;
                const offset = range.startOffset;
                const result = getWordAtPosition(text, offset);
                if (result) {
                    word = result.word;
                }
            }
        }

        if (!word || !/^[a-zA-Z0-9]+$/.test(word)) return;

        // Remove existing highlights
        const previewElement = previewRef.current;
        previewElement.querySelectorAll('.word-highlight').forEach(el => {
            const parent = el.parentNode;
            if (parent) {
                parent.replaceChild(document.createTextNode(el.textContent || ''), el);
                parent.normalize();
            }
        });

        // Find and highlight all matching words in the preview
        highlightWordInElement(previewElement, word);

        // Re-select the first highlighted word after highlighting
        requestAnimationFrame(() => {
            const highlightedElements = previewElement.querySelectorAll('.word-highlight');
            if (highlightedElements.length > 0) {
                // Find the highlighted element closest to where the user clicked
                const clickX = e.clientX;
                const clickY = e.clientY;
                let closestElement: Element | null = null;
                let minDistance = Infinity;

                highlightedElements.forEach(el => {
                    const rect = el.getBoundingClientRect();
                    const centerX = rect.left + rect.width / 2;
                    const centerY = rect.top + rect.height / 2;
                    const distance = Math.sqrt(Math.pow(clickX - centerX, 2) + Math.pow(clickY - centerY, 2));

                    if (distance < minDistance) {
                        minDistance = distance;
                        closestElement = el;
                    }
                });

                // Select the closest highlighted word
                if (closestElement) {
                    const range = document.createRange();
                    range.selectNodeContents(closestElement);
                    selection.removeAllRanges();
                    selection.addRange(range);
                }
            }
        });
    }, []);

    const handlePreviewClick = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
        if (!previewRef.current) return;

        // Check if we're clicking on a highlight
        const target = e.target as HTMLElement;
        if (target.classList.contains('word-highlight')) {
            return; // Don't clear if clicking on a highlight
        }

        // Clear all highlights
        const previewElement = previewRef.current;
        previewElement.querySelectorAll('.word-highlight').forEach(el => {
            const parent = el.parentNode;
            if (parent) {
                parent.replaceChild(document.createTextNode(el.textContent || ''), el);
                parent.normalize();
            }
        });
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

    const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLDivElement>) => {
        const fileId = activeFileIdRef.current;
        
        // Handle Ctrl+Z for Undo
        if (e.ctrlKey && e.key === 'z' && !e.shiftKey) {
            e.preventDefault();
            handleUndo();
            return;
        }

        // Handle Ctrl+Y or Ctrl+Shift+Z for Redo
        if ((e.ctrlKey && e.key === 'y') || (e.ctrlKey && e.shiftKey && e.key === 'Z')) {
            e.preventDefault();
            handleRedo();
            return;
        }

        // Handle Ctrl+B for Bold
        if (e.ctrlKey && e.key === 'b') {
            e.preventDefault();
            handleMarkdownInsert('**', '**', 'bold text');
            return;
        }

        // Handle Ctrl+I for Italic
        if (e.ctrlKey && e.key === 'i') {
            e.preventDefault();
            handleMarkdownInsert('*', '*', 'italic text');
            return;
        }

        // Handle Enter key for list continuation
        if (e.key === 'Enter' && !e.ctrlKey && !e.shiftKey && !e.altKey && fileId && contentEditableRef.current) {
            const element = contentEditableRef.current;
            const position = getCursorPosition(element);
            const value = getPlainText(element);

            // Find the start of the current line
            const lineStart = value.lastIndexOf('\n', position - 1) + 1;
            const currentLine = value.substring(lineStart, position);

            // Check for numbered list pattern (e.g., "1. ", "  2. ", "123. ")
            const numberedListMatch = currentLine.match(/^(\s*)(\d+)\.\s(.*)$/);
            if (numberedListMatch) {
                e.preventDefault();
                const [, indent, number] = numberedListMatch;

                // Continue the list with the next number
                const nextNumber = parseInt(number) + 1;
                const insertion = `\n${indent}${nextNumber}. `;

                const selection = window.getSelection();
                if (selection && selection.rangeCount > 0) {
                    const range = selection.getRangeAt(0);
                    range.deleteContents();
                    range.insertNode(document.createTextNode(insertion));
                    range.collapse(false);
                    selection.removeAllRanges();
                    selection.addRange(range);
                }

                const newValue = getPlainText(element);
                dispatch({
                    type: 'UPDATE_CONTENT',
                    payload: { id: fileId, content: newValue },
                });
                return;
            }

            // Check for bulleted list pattern (e.g., "- ", "* ", "+ ", "  - ")
            const bulletedListMatch = currentLine.match(/^(\s*)([-*+])\s(.*)$/);
            if (bulletedListMatch) {
                e.preventDefault();
                const [, indent, bullet] = bulletedListMatch;

                // Continue the list with the same bullet marker
                const insertion = `\n${indent}${bullet} `;

                const selection = window.getSelection();
                if (selection && selection.rangeCount > 0) {
                    const range = selection.getRangeAt(0);
                    range.deleteContents();
                    range.insertNode(document.createTextNode(insertion));
                    range.collapse(false);
                    selection.removeAllRanges();
                    selection.addRange(range);
                }

                const newValue = getPlainText(element);
                dispatch({
                    type: 'UPDATE_CONTENT',
                    payload: { id: fileId, content: newValue },
                });
                return;
            }

            // Check for task list pattern (e.g., "- [ ] ", "- [x] ")
            const taskListMatch = currentLine.match(/^(\s*)([-*+])\s\[([ xX])\]\s(.*)$/);
            if (taskListMatch) {
                e.preventDefault();
                const [, indent, bullet] = taskListMatch;

                // Continue with a new unchecked task
                const insertion = `\n${indent}${bullet} [ ] `;

                const selection = window.getSelection();
                if (selection && selection.rangeCount > 0) {
                    const range = selection.getRangeAt(0);
                    range.deleteContents();
                    range.insertNode(document.createTextNode(insertion));
                    range.collapse(false);
                    selection.removeAllRanges();
                    selection.addRange(range);
                }

                const newValue = getPlainText(element);
                dispatch({
                    type: 'UPDATE_CONTENT',
                    payload: { id: fileId, content: newValue },
                });
                return;
            }
        }

        // Handle Tab key for indentation
        if (e.key === 'Tab' && fileId && contentEditableRef.current) {
            e.preventDefault();

            const selection = window.getSelection();
            if (selection && selection.rangeCount > 0) {
                const range = selection.getRangeAt(0);
                range.deleteContents();
                range.insertNode(document.createTextNode('    '));
                range.collapse(false);
                selection.removeAllRanges();
                selection.addRange(range);

                const newValue = getPlainText(contentEditableRef.current);
                dispatch({
                    type: 'UPDATE_CONTENT',
                    payload: { id: fileId, content: newValue },
                });
            }
        }
    }, [dispatch, handleMarkdownInsert, handleUndo, handleRedo]);

    const markdownPlugins = useMemo(() => [remarkGfm], []);

    // Throttled scroll position update to reduce dispatch calls
    const handleScrollThrottled = useCallback((scrollTop: number) => {
        const fileId = activeFileIdRef.current;
        if (!fileId) return;
        
        if (scrollThrottleRef.current) {
            clearTimeout(scrollThrottleRef.current);
        }
        scrollThrottleRef.current = setTimeout(() => {
            dispatch({
                type: 'UPDATE_SCROLL_POSITION',
                payload: { id: fileId, scrollPosition: scrollTop }
            });
        }, 100);
    }, [dispatch]);

    // Handle paste to strip rich text formatting
    const handlePaste = useCallback((e: React.ClipboardEvent<HTMLDivElement>) => {
        e.preventDefault();

        // Get plain text from clipboard
        const text = e.clipboardData.getData('text/plain');

        // Insert as plain text using execCommand or Range API
        const selection = window.getSelection();
        if (selection && selection.rangeCount > 0) {
            const range = selection.getRangeAt(0);
            range.deleteContents();
            range.insertNode(document.createTextNode(text));
            range.collapse(false);
            selection.removeAllRanges();
            selection.addRange(range);
        }

        // Update content
        const fileId = activeFileIdRef.current;
        if (fileId && contentEditableRef.current) {
            const newContent = getPlainText(contentEditableRef.current);
            dispatch({
                type: 'UPDATE_CONTENT',
                payload: { id: fileId, content: newContent },
            });
        }
    }, [dispatch]);

    // Find all matches of search query in text (case-insensitive)
    const findAllMatches = useCallback((text: string, query: string): Array<{ start: number; end: number }> => {
        if (!query) return [];

        const matches: Array<{ start: number; end: number }> = [];
        const lowerText = text.toLowerCase();
        const lowerQuery = query.toLowerCase();
        let index = 0;

        while ((index = lowerText.indexOf(lowerQuery, index)) !== -1) {
            matches.push({ start: index, end: index + query.length });
            index += 1;
        }

        return matches;
    }, []);

    // Highlight search match in preview mode
    const highlightSearchInPreview = useCallback((query: string, matchIndex: number) => {
        if (!previewRef.current || !query) return;

        const previewElement = previewRef.current;

        // Clear existing search highlights
        previewElement.querySelectorAll('.search-highlight, .current-match').forEach(el => {
            const parent = el.parentNode;
            if (parent) {
                parent.replaceChild(document.createTextNode(el.textContent || ''), el);
                parent.normalize();
            }
        });

        // Find all text nodes and highlight matches
        let currentMatchCount = 0;
        const regex = new RegExp(`(${query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');

        const highlightInNode = (node: Node) => {
            if (node.nodeType === Node.TEXT_NODE && node.textContent) {
                const text = node.textContent;
                if (regex.test(text)) {
                    regex.lastIndex = 0;
                    const span = document.createElement('span');
                    let lastIndex = 0;
                    let match;

                    while ((match = regex.exec(text)) !== null) {
                        if (match.index > lastIndex) {
                            span.appendChild(document.createTextNode(text.substring(lastIndex, match.index)));
                        }

                        const highlight = document.createElement('span');
                        highlight.className = currentMatchCount === matchIndex ? 'current-match' : 'search-highlight';
                        highlight.textContent = match[0];
                        span.appendChild(highlight);

                        if (currentMatchCount === matchIndex) {
                            requestAnimationFrame(() => {
                                highlight.scrollIntoView({ behavior: 'smooth', block: 'center' });
                            });
                        }

                        currentMatchCount++;
                        lastIndex = match.index + match[0].length;
                    }

                    if (lastIndex < text.length) {
                        span.appendChild(document.createTextNode(text.substring(lastIndex)));
                    }

                    node.parentNode?.replaceChild(span, node);
                }
            } else if (node.nodeType === Node.ELEMENT_NODE) {
                const el = node as HTMLElement;
                if (!['SCRIPT', 'STYLE'].includes(el.tagName)) {
                    Array.from(node.childNodes).forEach(highlightInNode);
                }
            }
        };

        Array.from(previewElement.childNodes).forEach(highlightInNode);
    }, []);

    // Highlight search match and line in edit mode
    const highlightSearchMatch = useCallback((matchIndex: number, matches: Array<{ start: number; end: number }>, customText?: string) => {
        if (!contentEditableRef.current || !activeFile || matches.length === 0 || matchIndex < 0) return;

        const element = contentEditableRef.current;
        const text = customText ?? activeFile.content;

        // Clear existing search highlights
        clearSearchHighlights(element);

        // Reset content to plain text
        element.textContent = text;

        if (matchIndex >= matches.length) return;

        const match = matches[matchIndex];

        // Find line boundaries for current match
        const lineStart = text.lastIndexOf('\n', match.start - 1) + 1;
        let lineEnd = text.indexOf('\n', match.start);
        if (lineEnd === -1) lineEnd = text.length;

        // We need to highlight both the line and the match
        // First, wrap the entire line in a line-highlight span
        // Then wrap the match in a current-match span

        const beforeLine = text.substring(0, lineStart);
        const lineContent = text.substring(lineStart, lineEnd);
        const afterLine = text.substring(lineEnd);

        // Calculate match position within the line
        const matchStartInLine = match.start - lineStart;
        const matchEndInLine = match.end - lineStart;

        const beforeMatch = lineContent.substring(0, matchStartInLine);
        const matchText = lineContent.substring(matchStartInLine, matchEndInLine);
        const afterMatch = lineContent.substring(matchEndInLine);

        // Build the DOM
        element.textContent = '';

        if (beforeLine) {
            element.appendChild(document.createTextNode(beforeLine));
        }

        // Create line highlight span
        const lineSpan = document.createElement('span');
        lineSpan.className = 'current-line-highlight';

        if (beforeMatch) {
            lineSpan.appendChild(document.createTextNode(beforeMatch));
        }

        // Create match highlight span
        const matchSpan = document.createElement('span');
        matchSpan.className = 'current-match';
        matchSpan.textContent = matchText;
        lineSpan.appendChild(matchSpan);

        if (afterMatch) {
            lineSpan.appendChild(document.createTextNode(afterMatch));
        }

        element.appendChild(lineSpan);

        if (afterLine) {
            element.appendChild(document.createTextNode(afterLine));
        }

        // Scroll match into view
        requestAnimationFrame(() => {
            matchSpan.scrollIntoView({ behavior: 'smooth', block: 'center' });
        });
    }, [activeFile]);

    // Find Next - search from current cursor position (works in both edit and preview modes)
    const handleFindNext = useCallback(() => {
        if (!searchQuery || !activeFile) return;

        const text = activeFile.content;
        const matches = findAllMatches(text, searchQuery);

        if (matches.length === 0) {
            setSearchMatches([]);
            setCurrentSearchIndex(-1);
            setMatchCount(0);
            return;
        }

        setSearchMatches(matches);

        // Calculate next index
        let nextIndex;
        if (currentSearchIndex >= 0 && currentSearchIndex < matches.length) {
            // Move to next match
            nextIndex = (currentSearchIndex + 1) % matches.length;
        } else {
            // Start from beginning or from cursor position in edit mode
            if (activeFile.viewMode === 'edit' && contentEditableRef.current) {
                const cursorPos = getCursorPosition(contentEditableRef.current);
                nextIndex = matches.findIndex(m => m.start >= cursorPos);
                if (nextIndex === -1) {
                    nextIndex = 0; // Wrap to beginning
                }
            } else {
                nextIndex = 0;
            }
        }

        setCurrentSearchIndex(nextIndex);

        // Highlight based on view mode
        if (activeFile.viewMode === 'edit') {
            highlightSearchMatch(nextIndex, matches);
            if (contentEditableRef.current) {
                setCursorPosition(contentEditableRef.current, matches[nextIndex].end);
            }
        } else {
            // Preview mode
            highlightSearchInPreview(searchQuery, nextIndex);
        }
    }, [searchQuery, activeFile, findAllMatches, highlightSearchMatch, highlightSearchInPreview, currentSearchIndex]);

    // Count occurrences
    const handleCount = useCallback(() => {
        if (!searchQuery || !activeFile) {
            setMatchCount(0);
            return;
        }

        const matches = findAllMatches(activeFile.content, searchQuery);
        setMatchCount(matches.length);
        setSearchMatches(matches);
    }, [searchQuery, activeFile, findAllMatches]);

    // Replace current match
    const handleReplace = useCallback(() => {
        if (!searchQuery || !activeFile || activeFile.viewMode !== 'edit') return;
        if (!contentEditableRef.current) return;

        const text = activeFile.content;
        let matches = searchMatches;

        // If matches haven't been found yet, find them now
        if (matches.length === 0) {
            matches = findAllMatches(text, searchQuery);
            if (matches.length === 0) {
                setMatchCount(0);
                return;
            }
            setSearchMatches(matches);
            setMatchCount(matches.length);
        }

        // If no current match selected, find the first one from cursor position
        let matchIndex = currentSearchIndex;
        if (matchIndex < 0 || matchIndex >= matches.length) {
            const cursorPos = getCursorPosition(contentEditableRef.current);
            matchIndex = matches.findIndex(m => m.start >= cursorPos);
            if (matchIndex === -1) {
                matchIndex = 0; // Wrap to beginning
            }
            setCurrentSearchIndex(matchIndex);
            highlightSearchMatch(matchIndex, matches);
            return; // Just highlight on first call, replace on next
        }

        const match = matches[matchIndex];

        // Build new content with replacement
        const newContent = text.substring(0, match.start) + replaceQuery + text.substring(match.end);

        // Update content via dispatch
        dispatch({
            type: 'UPDATE_CONTENT',
            payload: { id: activeFile.id, content: newContent },
        });
        dispatch({
            type: 'PUSH_UNDO',
            payload: { id: activeFile.id, content: newContent },
        });

        // Update contenteditable DOM
        const newCursorPos = match.start + replaceQuery.length;
        setPlainText(contentEditableRef.current, newContent, newCursorPos);

        // Recalculate matches with new content
        const newMatches = findAllMatches(newContent, searchQuery);
        setSearchMatches(newMatches);
        setMatchCount(newMatches.length);

        // Find and navigate to next match
        if (newMatches.length > 0) {
            // Find the next match at or after the replacement position
            let nextIndex = newMatches.findIndex(m => m.start >= newCursorPos);
            if (nextIndex === -1) {
                nextIndex = 0; // Wrap to beginning
            }
            setCurrentSearchIndex(nextIndex);
            highlightSearchMatch(nextIndex, newMatches, newContent);
            setCursorPosition(contentEditableRef.current, newMatches[nextIndex].end);
        } else {
            setCurrentSearchIndex(-1);
            clearSearchHighlights(contentEditableRef.current);
        }
    }, [searchQuery, replaceQuery, activeFile, currentSearchIndex, searchMatches, dispatch, findAllMatches, highlightSearchMatch]);

    // Replace all matches
    const handleReplaceAll = useCallback(() => {
        if (!searchQuery || !activeFile || activeFile.viewMode !== 'edit') return;
        if (!contentEditableRef.current) return;

        const matches = findAllMatches(activeFile.content, searchQuery);
        if (matches.length === 0) return;

        let text = activeFile.content;
        const replacedCount = matches.length;

        // Replace from end to beginning to preserve positions
        const sortedMatches = [...matches].sort((a, b) => b.start - a.start);

        for (const match of sortedMatches) {
            text = text.substring(0, match.start) + replaceQuery + text.substring(match.end);
        }

        // Update content via dispatch
        dispatch({
            type: 'UPDATE_CONTENT',
            payload: { id: activeFile.id, content: text },
        });
        dispatch({
            type: 'PUSH_UNDO',
            payload: { id: activeFile.id, content: text },
        });

        // Update DOM
        contentEditableRef.current.textContent = text;

        // Clear matches and show notification
        setSearchMatches([]);
        setCurrentSearchIndex(-1);
        setMatchCount(0);

        // Show notification
        dispatch({
            type: 'SHOW_NOTIFICATION',
            payload: {
                message: `Replaced ${replacedCount} occurrence${replacedCount !== 1 ? 's' : ''}`,
                severity: 'success',
            },
        });
    }, [searchQuery, replaceQuery, activeFile, dispatch, findAllMatches]);

    // Open Find dialog
    const handleOpenFind = useCallback((tab: 'find' | 'replace' = 'find') => {
        setFindDialogOpen(true);
        setActiveDialogTab(tab);
        setMatchCount(null);
    }, []);

    // Close Find dialog
    const handleCloseFind = useCallback(() => {
        setFindDialogOpen(false);
        setSearchQuery('');
        setReplaceQuery('');
        setSearchMatches([]);
        setCurrentSearchIndex(-1);
        setMatchCount(null);
        setActiveDialogTab('find');

        // Clear search highlights based on view mode
        if (activeFile?.viewMode === 'edit' && contentEditableRef.current) {
            contentEditableRef.current.textContent = activeFile.content;
        } else if (activeFile?.viewMode === 'preview' && previewRef.current) {
            // Clear search highlights in preview
            previewRef.current.querySelectorAll('.search-highlight, .current-match').forEach(el => {
                const parent = el.parentNode;
                if (parent) {
                    parent.replaceChild(document.createTextNode(el.textContent || ''), el);
                    parent.normalize();
                }
            });
        }
    }, [activeFile]);

    // Listen for Ctrl+F / Ctrl+H events from App.tsx
    useEffect(() => {
        const handleOpenFindEvent = (e: Event) => {
            if (activeFile) {
                const customEvent = e as CustomEvent<{ tab?: 'find' | 'replace' }>;
                const tab = customEvent.detail?.tab || 'find';
                handleOpenFind(tab);
            }
        };

        window.addEventListener('open-find-dialog', handleOpenFindEvent);
        return () => window.removeEventListener('open-find-dialog', handleOpenFindEvent);
    }, [activeFile, handleOpenFind]);

    // Sync activeFile content to contenteditable when it changes programmatically (undo/redo/file switch)
    React.useEffect(() => {
        // Skip if this is a user input change (content already in DOM)
        if (isUserInputRef.current) {
            isUserInputRef.current = false;
            return;
        }

        if (!activeFile || !contentEditableRef.current) return;

        // Only update if we're in edit mode
        if (activeFile.viewMode !== 'edit') return;

        const currentText = getPlainText(contentEditableRef.current);
        if (currentText !== activeFile.content) {
            // Clear any highlights first
            clearWordHighlights(contentEditableRef.current);

            const cursorPos = getCursorPosition(contentEditableRef.current);
            setPlainText(contentEditableRef.current, activeFile.content, cursorPos);

            // Clear highlight state
            setHighlightedMatches([]);
            setCurrentMatchIndex(0);
        }
    }, [activeFile?.content, activeFile?.viewMode]);

    // Initialize contenteditable when switching to edit mode
    React.useEffect(() => {
        if (!activeFile || activeFile.viewMode !== 'edit' || !contentEditableRef.current) return;

        // Ensure contenteditable is populated with content when switching to edit mode
        const currentText = getPlainText(contentEditableRef.current);
        if (currentText !== activeFile.content) {
            clearWordHighlights(contentEditableRef.current);
            contentEditableRef.current.textContent = activeFile.content;
            setHighlightedMatches([]);
            setCurrentMatchIndex(0);
        }

        // Clear any highlights from preview mode
        if (previewRef.current) {
            previewRef.current.querySelectorAll('.word-highlight').forEach(el => {
                const parent = el.parentNode;
                if (parent) {
                    parent.replaceChild(document.createTextNode(el.textContent || ''), el);
                    parent.normalize();
                }
            });
        }
    }, [activeFile?.viewMode, activeFile?.id]);

    // Restore scroll position when switching modes or changing files
    React.useEffect(() => {
        if (!activeFile) return;

        const element = activeFile.viewMode === 'edit' ? contentEditableRef.current : previewRef.current;
        if (element && activeFile.scrollPosition > 0) {
            requestAnimationFrame(() => {
                element.scrollTop = activeFile.scrollPosition;
            });
        }
    }, [activeFile?.id, activeFile?.viewMode]);

    if (!activeFile) {
        return null;
    }

    // Edit mode - show textarea editor
    if (activeFile.viewMode === 'edit') {
        return (
            <EditorContainer>
                <MarkdownToolbar
                    mode="edit"
                    onInsert={handleMarkdownInsert}
                    onUndo={handleUndo}
                    onRedo={handleRedo}
                    onFind={handleOpenFind}
                />
                <EditorWrapper>
                    <ContentEditableDiv
                        ref={contentEditableRef}
                        contentEditable
                        suppressContentEditableWarning
                        data-placeholder="Start typing markdown..."
                        onInput={handleContentChange}
                        onKeyDown={handleKeyDown}
                        onClick={handleClick}
                        onDoubleClick={handleDoubleClick}
                        onPaste={handlePaste}
                        spellCheck={false}
                        onScroll={(e) => {
                            const target = e.target as HTMLDivElement;
                            handleScrollThrottled(target.scrollTop);
                        }}
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
                        onSearchQueryChange={(query) => {
                            setSearchQuery(query);
                            setCurrentSearchIndex(-1);
                            setMatchCount(null);
                        }}
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

    // Preview mode - show rendered markdown
    return (
        <EditorContainer>
            <MarkdownToolbar
                mode="preview"
                onFind={handleOpenFind}
            />
            <EditorWrapper>
                <MarkdownPreview
                    ref={previewRef}
                    onClick={handlePreviewClick}
                    onDoubleClick={handlePreviewDoubleClick}
                    onScroll={(e) => {
                        const target = e.target as HTMLDivElement;
                        handleScrollThrottled(target.scrollTop);
                    }}
                >
                    <ReactMarkdown remarkPlugins={markdownPlugins}>
                        {activeFile.content || '*No content*'}
                    </ReactMarkdown>
                </MarkdownPreview>
                <FindReplaceDialog
                    open={findDialogOpen}
                    mode="preview"
                    activeTab={activeDialogTab}
                    searchQuery={searchQuery}
                    replaceQuery={replaceQuery}
                    matchCount={matchCount}
                    currentMatchIndex={currentSearchIndex}
                    totalMatches={searchMatches.length}
                    onTabChange={setActiveDialogTab}
                    onSearchQueryChange={(query) => {
                        setSearchQuery(query);
                        setCurrentSearchIndex(-1);
                        setMatchCount(null);
                    }}
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
