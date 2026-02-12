import React from 'react';
import { Box, IconButton, Tooltip, Divider, styled } from '@mui/material';
import {
    FormatBoldIcon,
    FormatItalicIcon,
    FormatStrikethroughIcon,
    CodeIcon,
    TitleIcon,
    FormatQuoteIcon,
    FormatListBulletedIcon,
    FormatListNumberedIcon,
    CheckBoxIcon,
    LinkIcon,
    ImageIcon,
    TableChartIcon,
    HorizontalRuleIcon,
    UndoIcon,
    RedoIcon,
    SearchIcon,
    PictureAsPdfIcon,
} from './AppIcons';
import { useActiveFile } from '../contexts';

const ToolbarContainer = styled(Box)(({ theme }) => ({
    display: 'flex',
    alignItems: 'center',
    gap: 4,
    padding: '4px 8px',
    backgroundColor: theme.palette.background.paper,
    borderBottom: `1px solid ${theme.palette.divider}`,
    flexWrap: 'wrap',
}));

const ToolbarDivider = styled(Divider)({
    height: 24,
    margin: '0 4px',
});

interface MarkdownToolbarProps {
    mode: 'edit' | 'preview';
    onInsert?: (before: string, after: string, placeholder?: string) => void;
    onUndo?: () => void;
    onRedo?: () => void;
    onFind?: () => void;
    onExportPdf?: () => void;
}

export function MarkdownToolbar({ mode, onInsert, onUndo, onRedo, onFind, onExportPdf }: MarkdownToolbarProps) {
    const activeFile = useActiveFile();
    const canUndo = activeFile ? activeFile.undoStackPointer > 0 : false;
    const canRedo = activeFile ? activeFile.redoStack.length > 0 : false;

    // Preview mode toolbar - only show Find button
    if (mode === 'preview') {
        return (
            <ToolbarContainer>
                <Tooltip title="Find (Ctrl+F)">
                    <IconButton size="small" onClick={onFind}>
                        <SearchIcon fontSize="small" />
                    </IconButton>
                </Tooltip>
                <Box sx={{ flexGrow: 1 }} />
                <ToolbarDivider orientation="vertical" flexItem />
                <Tooltip title="Export PDF">
                    <IconButton size="small" onClick={onExportPdf}>
                        <PictureAsPdfIcon fontSize="small" />
                    </IconButton>
                </Tooltip>
            </ToolbarContainer>
        );
    }

    // Edit mode toolbar - show all buttons
    return (
        <ToolbarContainer>
            <Tooltip title="Undo (Ctrl+Z)">
                <span>
                    <IconButton size="small" onClick={onUndo} disabled={!canUndo}>
                        <UndoIcon fontSize="small" />
                    </IconButton>
                </span>
            </Tooltip>

            <Tooltip title="Redo (Ctrl+Y)">
                <span>
                    <IconButton size="small" onClick={onRedo} disabled={!canRedo}>
                        <RedoIcon fontSize="small" />
                    </IconButton>
                </span>
            </Tooltip>

            <ToolbarDivider orientation="vertical" flexItem />

            <Tooltip title="Bold (Ctrl+B)">
                <IconButton size="small" onClick={() => onInsert?.('**', '**', 'bold text')}>
                    <FormatBoldIcon fontSize="small" />
                </IconButton>
            </Tooltip>

            <Tooltip title="Italic (Ctrl+I)">
                <IconButton size="small" onClick={() => onInsert?.('*', '*', 'italic text')}>
                    <FormatItalicIcon fontSize="small" />
                </IconButton>
            </Tooltip>

            <Tooltip title="Strikethrough">
                <IconButton size="small" onClick={() => onInsert?.('~~', '~~', 'strikethrough text')}>
                    <FormatStrikethroughIcon fontSize="small" />
                </IconButton>
            </Tooltip>

            <ToolbarDivider orientation="vertical" flexItem />

            <Tooltip title="Heading 1">
                <IconButton size="small" onClick={() => onInsert?.('# ', '', 'Heading 1')}>
                    <TitleIcon fontSize="small" />
                </IconButton>
            </Tooltip>

            <Tooltip title="Heading 2">
                <IconButton size="small" onClick={() => onInsert?.('## ', '', 'Heading 2')}>
                    <Box sx={{ fontSize: 10, fontWeight: 'bold' }}>H2</Box>
                </IconButton>
            </Tooltip>

            <Tooltip title="Heading 3">
                <IconButton size="small" onClick={() => onInsert?.('### ', '', 'Heading 3')}>
                    <Box sx={{ fontSize: 10, fontWeight: 'bold' }}>H3</Box>
                </IconButton>
            </Tooltip>

            <ToolbarDivider orientation="vertical" flexItem />

            <Tooltip title="Code">
                <IconButton size="small" onClick={() => onInsert?.('`', '`', 'code')}>
                    <CodeIcon fontSize="small" />
                </IconButton>
            </Tooltip>

            <Tooltip title="Code Block">
                <IconButton size="small" onClick={() => onInsert?.('```\n', '\n```', 'code block')}>
                    <Box sx={{ fontSize: 10, fontWeight: 'bold' }}>{'{ }'}</Box>
                </IconButton>
            </Tooltip>

            <ToolbarDivider orientation="vertical" flexItem />

            <Tooltip title="Quote">
                <IconButton size="small" onClick={() => onInsert?.('> ', '', 'quote')}>
                    <FormatQuoteIcon fontSize="small" />
                </IconButton>
            </Tooltip>

            <Tooltip title="Bulleted List">
                <IconButton size="small" onClick={() => onInsert?.('- ', '', 'list item')}>
                    <FormatListBulletedIcon fontSize="small" />
                </IconButton>
            </Tooltip>

            <Tooltip title="Numbered List">
                <IconButton size="small" onClick={() => onInsert?.('1. ', '', 'list item')}>
                    <FormatListNumberedIcon fontSize="small" />
                </IconButton>
            </Tooltip>

            <Tooltip title="Task List">
                <IconButton size="small" onClick={() => onInsert?.('- [ ] ', '', 'task')}>
                    <CheckBoxIcon fontSize="small" />
                </IconButton>
            </Tooltip>

            <ToolbarDivider orientation="vertical" flexItem />

            <Tooltip title="Link">
                <IconButton size="small" onClick={() => onInsert?.('[', '](url)', 'link text')}>
                    <LinkIcon fontSize="small" />
                </IconButton>
            </Tooltip>

            <Tooltip title="Image">
                <IconButton size="small" onClick={() => onInsert?.('![', '](url)', 'alt text')}>
                    <ImageIcon fontSize="small" />
                </IconButton>
            </Tooltip>

            <ToolbarDivider orientation="vertical" flexItem />

            <Tooltip title="Table">
                <IconButton size="small" onClick={() => onInsert?.('| Header 1 | Header 2 |\n| -------- | -------- |\n| ', ' | Cell 2 |', 'Cell 1')}>
                    <TableChartIcon fontSize="small" />
                </IconButton>
            </Tooltip>

            <Tooltip title="Horizontal Rule">
                <IconButton size="small" onClick={() => onInsert?.('\n---\n', '', '')}>
                    <HorizontalRuleIcon fontSize="small" />
                </IconButton>
            </Tooltip>

            <ToolbarDivider orientation="vertical" flexItem />

            <Tooltip title="Find (Ctrl+F)">
                <IconButton size="small" onClick={onFind}>
                    <SearchIcon fontSize="small" />
                </IconButton>
            </Tooltip>
            <Box sx={{ flexGrow: 1 }} />
            <ToolbarDivider orientation="vertical" flexItem />
            <Tooltip title="Export PDF">
                <IconButton size="small" onClick={onExportPdf}>
                    <PictureAsPdfIcon fontSize="small" />
                </IconButton>
            </Tooltip>
        </ToolbarContainer>
    );
}
