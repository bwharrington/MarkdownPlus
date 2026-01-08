import React, { useCallback, useMemo, useRef } from 'react';
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

const TextArea = styled('textarea')(({ theme }) => ({
    flex: 1,
    padding: 16,
    border: 'none',
    outline: 'none',
    resize: 'none',
    fontFamily: 'Consolas, Monaco, "Courier New", monospace',
    fontSize: 14,
    lineHeight: 1.6,
    backgroundColor: theme.palette.background.default,
    color: theme.palette.text.primary,
    '&::placeholder': {
        color: theme.palette.text.secondary,
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

export function EditorPane() {
    const activeFile = useActiveFile();
    const dispatch = useEditorDispatch();
    const textareaRef = useRef<HTMLTextAreaElement>(null);
    const previewRef = useRef<HTMLDivElement>(null);
    const lastContentRef = useRef<string>('');
    const undoTimeoutRef = useRef<NodeJS.Timeout | null>(null);

    const handleContentChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
        if (activeFile) {
            const newContent = e.target.value;
            dispatch({
                type: 'UPDATE_CONTENT',
                payload: { id: activeFile.id, content: newContent },
            });

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

    const handleMarkdownInsert = useCallback((before: string, after: string, placeholder?: string) => {
        if (!activeFile || !textareaRef.current) return;

        const textarea = textareaRef.current;
        const start = textarea.selectionStart;
        const end = textarea.selectionEnd;
        const selectedText = textarea.value.substring(start, end);
        const textToInsert = selectedText || placeholder || '';
        
        const newText = before + textToInsert + after;
        const newValue = 
            textarea.value.substring(0, start) + 
            newText + 
            textarea.value.substring(end);

        dispatch({
            type: 'UPDATE_CONTENT',
            payload: { id: activeFile.id, content: newValue },
        });

        // Push to undo stack immediately for manual edits
        dispatch({
            type: 'PUSH_UNDO',
            payload: { id: activeFile.id, content: newValue },
        });

        // Set cursor position
        requestAnimationFrame(() => {
            const newCursorPos = start + before.length + textToInsert.length;
            textarea.focus();
            textarea.setSelectionRange(newCursorPos, newCursorPos);
        });
    }, [activeFile, dispatch]);

    const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLTextAreaElement>) => {
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
        if (e.key === 'Enter' && !e.ctrlKey && !e.shiftKey && !e.altKey && activeFile) {
            const target = e.target as HTMLTextAreaElement;
            const start = target.selectionStart;
            const value = target.value;
            
            // Find the start of the current line
            const lineStart = value.lastIndexOf('\n', start - 1) + 1;
            const currentLine = value.substring(lineStart, start);
            
            // Check for numbered list pattern (e.g., "1. ", "  2. ", "123. ")
            const numberedListMatch = currentLine.match(/^(\s*)(\d+)\.\s(.*)$/);
            if (numberedListMatch) {
                e.preventDefault();
                const [, indent, number] = numberedListMatch;
                
                // Continue the list with the next number
                const nextNumber = parseInt(number) + 1;
                const insertion = `\n${indent}${nextNumber}. `;
                const newValue = value.substring(0, start) + insertion + value.substring(target.selectionEnd);
                dispatch({
                    type: 'UPDATE_CONTENT',
                    payload: { id: activeFile.id, content: newValue },
                });
                requestAnimationFrame(() => {
                    target.selectionStart = target.selectionEnd = start + insertion.length;
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
                const newValue = value.substring(0, start) + insertion + value.substring(target.selectionEnd);
                dispatch({
                    type: 'UPDATE_CONTENT',
                    payload: { id: activeFile.id, content: newValue },
                });
                requestAnimationFrame(() => {
                    target.selectionStart = target.selectionEnd = start + insertion.length;
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
                const newValue = value.substring(0, start) + insertion + value.substring(target.selectionEnd);
                dispatch({
                    type: 'UPDATE_CONTENT',
                    payload: { id: activeFile.id, content: newValue },
                });
                requestAnimationFrame(() => {
                    target.selectionStart = target.selectionEnd = start + insertion.length;
                });
                return;
            }
        }

        // Handle Tab key for indentation
        if (e.key === 'Tab') {
            e.preventDefault();
            const target = e.target as HTMLTextAreaElement;
            const start = target.selectionStart;
            const end = target.selectionEnd;
            const value = target.value;
            
            // Insert tab at cursor position
            const newValue = value.substring(0, start) + '    ' + value.substring(end);
            
            if (activeFile) {
                dispatch({
                    type: 'UPDATE_CONTENT',
                    payload: { id: activeFile.id, content: newValue },
                });
                
                // Set cursor position after tab
                requestAnimationFrame(() => {
                    target.selectionStart = target.selectionEnd = start + 4;
                });
            }
        }
    }, [activeFile, dispatch, handleMarkdownInsert, handleUndo, handleRedo]);

    const markdownPlugins = useMemo(() => [remarkGfm], []);

    // Restore scroll position when switching modes or changing files
    React.useEffect(() => {
        if (!activeFile) return;
        
        const element = activeFile.viewMode === 'edit' ? textareaRef.current : previewRef.current;
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
                <TextArea
                    ref={textareaRef}
                    value={activeFile.content}
                    onChange={handleContentChange}
                    onKeyDown={handleKeyDown}
                    placeholder="Start typing markdown..."
                    spellCheck={false}
                    onScroll={(e) => {
                        if (activeFile) {
                            const target = e.target as HTMLTextAreaElement;
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
