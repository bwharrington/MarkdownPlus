import { Box, styled } from '@mui/material';

/**
 * Shared preview container styles used by both Markdown and RST renderers.
 * Contains base typography, code, lists, tables, links, images, and highlight styles.
 */
export const PreviewContainer = styled(Box)(({ theme }) => ({
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
    '& h4': { fontSize: '1.1em' },
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

/**
 * RST-specific preview container extending the shared PreviewContainer
 * with admonition and definition list styles.
 */
export const RstPreviewContainer = styled(PreviewContainer)(({ theme }) => ({
    '& .rst-note, & .rst-warning, & .rst-tip': {
        padding: '12px 16px',
        marginBottom: 16,
        borderRadius: 4,
    },
    '& .rst-note': {
        backgroundColor: theme.palette.mode === 'dark' ? 'rgba(33, 150, 243, 0.1)' : 'rgba(33, 150, 243, 0.1)',
        borderLeft: `4px solid ${theme.palette.info.main}`,
    },
    '& .rst-warning': {
        backgroundColor: theme.palette.mode === 'dark' ? 'rgba(255, 152, 0, 0.1)' : 'rgba(255, 152, 0, 0.1)',
        borderLeft: `4px solid ${theme.palette.warning.main}`,
    },
    '& .rst-tip': {
        backgroundColor: theme.palette.mode === 'dark' ? 'rgba(76, 175, 80, 0.1)' : 'rgba(76, 175, 80, 0.1)',
        borderLeft: `4px solid ${theme.palette.success.main}`,
    },
    '& dt': {
        fontWeight: 600,
        marginTop: 8,
    },
    '& dd': {
        marginLeft: 24,
        marginBottom: 8,
    },
}));
