import { Box, styled } from '@mui/material';

export const EditorContainer = styled(Box)({
    display: 'flex',
    flexDirection: 'column',
    flex: 1,
    overflow: 'hidden',
});

export const ContentEditableDiv = styled('div')(({ theme }) => ({
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
    // Diff highlight styles
    '& .diff-added': {
        backgroundColor: theme.palette.mode === 'dark'
            ? 'rgba(46, 160, 67, 0.25)'
            : 'rgba(46, 160, 67, 0.15)',
        display: 'block',
        marginLeft: -16,
        marginRight: -16,
        paddingLeft: 16,
        paddingRight: 16,
        borderLeft: '3px solid #2ea043',
    },
    '& .diff-removed': {
        backgroundColor: theme.palette.mode === 'dark'
            ? 'rgba(248, 81, 73, 0.25)'
            : 'rgba(248, 81, 73, 0.15)',
        display: 'block',
        marginLeft: -16,
        marginRight: -16,
        paddingLeft: 16,
        paddingRight: 16,
        borderLeft: '3px solid #f85149',
        textDecoration: 'line-through',
        opacity: 0.7,
    },
    '& .diff-modified-old': {
        backgroundColor: theme.palette.mode === 'dark'
            ? 'rgba(248, 81, 73, 0.25)'
            : 'rgba(248, 81, 73, 0.15)',
        display: 'block',
        marginLeft: -16,
        marginRight: -16,
        paddingLeft: 16,
        paddingRight: 16,
        borderLeft: '3px solid #f85149',
        textDecoration: 'line-through',
        opacity: 0.7,
    },
    '& .diff-modified-new': {
        backgroundColor: theme.palette.mode === 'dark'
            ? 'rgba(46, 160, 67, 0.25)'
            : 'rgba(46, 160, 67, 0.15)',
        display: 'block',
        marginLeft: -16,
        marginRight: -16,
        paddingLeft: 16,
        paddingRight: 16,
        borderLeft: '3px solid #2ea043',
    },
    '& .diff-current': {
        outline: '2px solid',
        outlineColor: theme.palette.primary.main,
        outlineOffset: 2,
    },
}));

export const EditorWrapper = styled(Box)({
    display: 'flex',
    flexDirection: 'column',
    flex: 1,
    overflow: 'hidden',
    position: 'relative',
});

export const SplitContainer = styled(Box)({
    display: 'flex',
    flex: 1,
    overflow: 'hidden',
});

export const SplitDivider = styled(Box)(({ theme }) => ({
    width: 4,
    backgroundColor: theme.palette.divider,
    cursor: 'col-resize',
    '&:hover': {
        backgroundColor: theme.palette.primary.main,
    },
}));
