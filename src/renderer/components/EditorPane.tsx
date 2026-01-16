import React, { useCallback, useMemo, useRef, useState } from 'react';
import { Box, styled } from '@mui/material';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { useActiveFile, useEditorDispatch } from '../contexts';
import { MarkdownToolbar } from './MarkdownToolbar';

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
        backgroundColor: theme.palette.mode === 'dark' ? 'rgba(255, 235, 59, 0.3)' : 'rgba(255, 235, 59, 0.5)',
        borderRadius: 2,
    },
}));

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
        backgroundColor: theme.palette.mode === 'dark' ? 'rgba(255, 235, 59, 0.3)' : 'rgba(255, 235, 59, 0.5)',
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

export function EditorPane() {
    const activeFile = useActiveFile();
    const dispatch = useEditorDispatch();
    const contentEditableRef = useRef<HTMLDivElement>(null);
    const previewRef = useRef<HTMLDivElement>(null);
    const lastContentRef = useRef<string>('');
    const undoTimeoutRef = useRef<NodeJS.Timeout | null>(null);
    const [highlightedMatches, setHighlightedMatches] = useState<Array<{ start: number; end: number }>>([]);
    const [currentMatchIndex, setCurrentMatchIndex] = useState<number>(0);

    const handleContentChange = useCallback(() => {
        if (activeFile && contentEditableRef.current) {
            const newContent = getPlainText(contentEditableRef.current);

            // Clear word highlights when content changes
            clearWordHighlights(contentEditableRef.current);

            dispatch({
                type: 'UPDATE_CONTENT',
                payload: { id: activeFile.id, content: newContent },
            });

            // Clear highlighted matches state
            setHighlightedMatches([]);
            setCurrentMatchIndex(0);

            // Push to undo stack after a short delay (debounce)
            if (undoTimeoutRef.current) {
                clearTimeout(undoTimeoutRef.current);
            }
            undoTimeoutRef.current = setTimeout(() => {
                if (lastContentRef.current !== newContent) {
                    dispatch({
                        type: 'PUSH_UNDO',
                        payload: { id: activeFile.id, content: newContent },
                    });
                    lastContentRef.current = newContent;
                }
            }, 500);
        }
    }, [activeFile, dispatch]);

    const handleUndo = useCallback(() => {
        if (activeFile) {
            dispatch({
                type: 'UNDO',
                payload: { id: activeFile.id },
            });
        }
    }, [activeFile, dispatch]);

    const handleRedo = useCallback(() => {
        if (activeFile) {
            dispatch({
                type: 'REDO',
                payload: { id: activeFile.id },
            });
        }
    }, [activeFile, dispatch]);

    const handleDoubleClick = useCallback(() => {
        if (!activeFile || !contentEditableRef.current) return;

        const element = contentEditableRef.current;
        const position = getCursorPosition(element);
        const text = getPlainText(element);

        // Get word at position and all matches
        const result = getWordAtPosition(text, position);

        if (result && result.matches.length > 0) {
            // Clear existing highlights
            clearWordHighlights(element);

            // Highlight all matches using the same function as preview mode
            highlightWordInElement(element, result.word);

            // Store match info for state tracking
            setHighlightedMatches(result.matches);

            // Find which match was clicked
            const clickedIndex = result.matches.findIndex(m => position >= m.start && position <= m.end);
            setCurrentMatchIndex(clickedIndex >= 0 ? clickedIndex : 0);

            // Restore cursor position after highlighting
            requestAnimationFrame(() => {
                setCursorPosition(element, position);
                element.focus();
            });
        } else {
            setHighlightedMatches([]);
            setCurrentMatchIndex(0);
        }
    }, [activeFile]);

    const handleClick = useCallback(() => {
        // Clear highlights on single click
        if (highlightedMatches.length > 0 && contentEditableRef.current) {
            clearWordHighlights(contentEditableRef.current);
            setHighlightedMatches([]);
            setCurrentMatchIndex(0);
        }
    }, [highlightedMatches]);

    const handlePreviewDoubleClick = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
        if (!activeFile || !previewRef.current) return;

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
    }, [activeFile]);

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
        if (!activeFile || !contentEditableRef.current) return;

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
                payload: { id: activeFile.id, content: newContent },
            });
            dispatch({
                type: 'PUSH_UNDO',
                payload: { id: activeFile.id, content: newContent },
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
            payload: { id: activeFile.id, content: newContent },
        });
        dispatch({
            type: 'PUSH_UNDO',
            payload: { id: activeFile.id, content: newContent },
        });

        element.focus();
    }, [activeFile, dispatch]);

    const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLDivElement>) => {
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
        if (e.key === 'Enter' && !e.ctrlKey && !e.shiftKey && !e.altKey && activeFile && contentEditableRef.current) {
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
                    payload: { id: activeFile.id, content: newValue },
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
                    payload: { id: activeFile.id, content: newValue },
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
                    payload: { id: activeFile.id, content: newValue },
                });
                return;
            }
        }

        // Handle Tab key for indentation
        if (e.key === 'Tab' && activeFile && contentEditableRef.current) {
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
                    payload: { id: activeFile.id, content: newValue },
                });
            }
        }
    }, [activeFile, dispatch, handleMarkdownInsert, handleUndo, handleRedo]);

    const markdownPlugins = useMemo(() => [remarkGfm], []);

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
        if (activeFile && contentEditableRef.current) {
            const newContent = getPlainText(contentEditableRef.current);
            dispatch({
                type: 'UPDATE_CONTENT',
                payload: { id: activeFile.id, content: newContent },
            });
        }
    }, [activeFile, dispatch]);

    // Sync activeFile content to contenteditable when it changes programmatically (undo/redo/file switch)
    React.useEffect(() => {
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
                    onInsert={handleMarkdownInsert}
                    onUndo={handleUndo}
                    onRedo={handleRedo}
                />
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
                        if (activeFile) {
                            const target = e.target as HTMLDivElement;
                            dispatch({
                                type: 'UPDATE_SCROLL_POSITION',
                                payload: { id: activeFile.id, scrollPosition: target.scrollTop }
                            });
                        }
                    }}
                />
            </EditorContainer>
        );
    }

    // Preview mode - show rendered markdown
    return (
        <EditorContainer>
            <MarkdownPreview
                ref={previewRef}
                onClick={handlePreviewClick}
                onDoubleClick={handlePreviewDoubleClick}
                onScroll={(e) => {
                    if (activeFile) {
                        const target = e.target as HTMLDivElement;
                        dispatch({
                            type: 'UPDATE_SCROLL_POSITION',
                            payload: { id: activeFile.id, scrollPosition: target.scrollTop }
                        });
                    }
                }}
            >
                <ReactMarkdown remarkPlugins={markdownPlugins}>
                    {activeFile.content || '*No content*'}
                </ReactMarkdown>
            </MarkdownPreview>
        </EditorContainer>
    );
}
