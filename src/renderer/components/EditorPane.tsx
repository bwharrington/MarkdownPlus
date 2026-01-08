import React, { useCallback, useMemo } from 'react';
import { Box, styled } from '@mui/material';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { useActiveFile, useEditorDispatch } from '../contexts';

const EditorContainer = styled(Box)({
    display: 'flex',
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

    const handleContentChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
        if (activeFile) {
            dispatch({
                type: 'UPDATE_CONTENT',
                payload: { id: activeFile.id, content: e.target.value },
            });
        }
    }, [activeFile, dispatch]);

    const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLTextAreaElement>) => {
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
    }, [activeFile, dispatch]);

    const markdownPlugins = useMemo(() => [remarkGfm], []);

    if (!activeFile) {
        return null;
    }

    // Plain text mode - just show textarea
    if (activeFile.viewMode === 'plaintext') {
        return (
            <EditorContainer>
                <TextArea
                    value={activeFile.content}
                    onChange={handleContentChange}
                    onKeyDown={handleKeyDown}
                    placeholder="Start typing..."
                    spellCheck={false}
                />
            </EditorContainer>
        );
    }

    // Markdown mode - show split view with editor and preview
    return (
        <SplitContainer>
            <TextArea
                value={activeFile.content}
                onChange={handleContentChange}
                onKeyDown={handleKeyDown}
                placeholder="Start typing markdown..."
                spellCheck={false}
                sx={{ borderRight: 1, borderColor: 'divider' }}
            />
            <SplitDivider />
            <MarkdownPreview>
                <ReactMarkdown remarkPlugins={markdownPlugins}>
                    {activeFile.content || '*No content*'}
                </ReactMarkdown>
            </MarkdownPreview>
        </SplitContainer>
    );
}
