import React from 'react';
import { Box, IconButton, Tooltip, Divider, styled } from '@mui/material';
import {
    FormatBoldIcon,
    FormatItalicIcon,
    CodeIcon,
    TitleIcon,
    FormatQuoteIcon,
    FormatListBulletedIcon,
    FormatListNumberedIcon,
    LinkIcon,
    ImageIcon,
    HorizontalRuleIcon,
    UndoIcon,
    RedoIcon,
    SearchIcon,
    InfoIcon,
    WarningIcon,
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

interface RstToolbarProps {
    mode: 'edit' | 'preview';
    onInsert?: (before: string, after: string, placeholder?: string) => void;
    onUndo?: () => void;
    onRedo?: () => void;
    onFind?: () => void;
    onExportPdf?: () => void;
}

export function RstToolbar({ mode, onInsert, onUndo, onRedo, onFind, onExportPdf }: RstToolbarProps) {
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

    // Edit mode toolbar - show RST-specific buttons
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

            <Tooltip title="Bold">
                <IconButton size="small" onClick={() => onInsert?.('**', '**', 'bold text')}>
                    <FormatBoldIcon fontSize="small" />
                </IconButton>
            </Tooltip>

            <Tooltip title="Italic">
                <IconButton size="small" onClick={() => onInsert?.('*', '*', 'italic text')}>
                    <FormatItalicIcon fontSize="small" />
                </IconButton>
            </Tooltip>

            <ToolbarDivider orientation="vertical" flexItem />

            <Tooltip title="Heading 1 (with = underline)">
                <IconButton size="small" onClick={() => onInsert?.('', '\n' + '='.repeat(20), 'Heading 1')}>
                    <TitleIcon fontSize="small" />
                </IconButton>
            </Tooltip>

            <Tooltip title="Heading 2 (with - underline)">
                <IconButton size="small" onClick={() => onInsert?.('', '\n' + '-'.repeat(20), 'Heading 2')}>
                    <Box sx={{ fontSize: 10, fontWeight: 'bold' }}>H2</Box>
                </IconButton>
            </Tooltip>

            <Tooltip title="Heading 3 (with ~ underline)">
                <IconButton size="small" onClick={() => onInsert?.('', '\n' + '~'.repeat(20), 'Heading 3')}>
                    <Box sx={{ fontSize: 10, fontWeight: 'bold' }}>H3</Box>
                </IconButton>
            </Tooltip>

            <ToolbarDivider orientation="vertical" flexItem />

            <Tooltip title="Inline Code">
                <IconButton size="small" onClick={() => onInsert?.('``', '``', 'code')}>
                    <CodeIcon fontSize="small" />
                </IconButton>
            </Tooltip>

            <Tooltip title="Code Block">
                <IconButton size="small" onClick={() => onInsert?.('.. code-block::\n\n   ', '', 'code here')}>
                    <Box sx={{ fontSize: 10, fontWeight: 'bold' }}>{'{ }'}</Box>
                </IconButton>
            </Tooltip>

            <ToolbarDivider orientation="vertical" flexItem />

            <Tooltip title="Block Quote">
                <IconButton size="small" onClick={() => onInsert?.('   ', '', 'quoted text')}>
                    <FormatQuoteIcon fontSize="small" />
                </IconButton>
            </Tooltip>

            <Tooltip title="Bulleted List">
                <IconButton size="small" onClick={() => onInsert?.('* ', '', 'list item')}>
                    <FormatListBulletedIcon fontSize="small" />
                </IconButton>
            </Tooltip>

            <Tooltip title="Numbered List">
                <IconButton size="small" onClick={() => onInsert?.('#. ', '', 'list item')}>
                    <FormatListNumberedIcon fontSize="small" />
                </IconButton>
            </Tooltip>

            <ToolbarDivider orientation="vertical" flexItem />

            <Tooltip title="Link">
                <IconButton size="small" onClick={() => onInsert?.('`', ' <url>`_', 'link text')}>
                    <LinkIcon fontSize="small" />
                </IconButton>
            </Tooltip>

            <Tooltip title="Image">
                <IconButton size="small" onClick={() => onInsert?.('.. image:: ', '\n   :alt: description', 'image-url')}>
                    <ImageIcon fontSize="small" />
                </IconButton>
            </Tooltip>

            <ToolbarDivider orientation="vertical" flexItem />

            <Tooltip title="Note Admonition">
                <IconButton size="small" onClick={() => onInsert?.('.. note::\n\n   ', '', 'Note text here')}>
                    <InfoIcon fontSize="small" />
                </IconButton>
            </Tooltip>

            <Tooltip title="Warning Admonition">
                <IconButton size="small" onClick={() => onInsert?.('.. warning::\n\n   ', '', 'Warning text here')}>
                    <WarningIcon fontSize="small" />
                </IconButton>
            </Tooltip>

            <ToolbarDivider orientation="vertical" flexItem />

            <Tooltip title="Horizontal Rule">
                <IconButton size="small" onClick={() => onInsert?.('\n----\n', '', '')}>
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
