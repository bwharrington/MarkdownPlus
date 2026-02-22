import React from 'react';
import { Box, Chip, styled } from '@mui/material';
import { VisibilityIcon, VisibilityOffIcon } from './AppIcons';

const AttachmentsContainer = styled(Box)(({ theme }) => ({
    display: 'flex',
    flexWrap: 'wrap',
    gap: 6,
    padding: '8px 12px',
    borderTop: `1px solid ${theme.palette.divider}`,
    backgroundColor: theme.palette.action.hover,
    maxHeight: 100,
    overflowY: 'auto',
}));

const GlowingChip = styled(Chip)({
    '@keyframes chipGlow': {
        '0%': {
            boxShadow: '0 0 6px rgba(64, 208, 255, 0.6), 0 0 14px rgba(10, 104, 200, 0.4)',
        },
        '20%': {
            boxShadow: '0 0 12px rgba(120, 232, 255, 1.0), 0 0 24px rgba(64, 208, 255, 0.7), 0 0 36px rgba(10, 104, 200, 0.4)',
        },
        '35%': {
            boxShadow: '0 0 6px rgba(64, 208, 255, 0.6), 0 0 14px rgba(10, 104, 200, 0.4)',
        },
        '50%': {
            boxShadow: '0 0 6px rgba(244, 200, 60, 0.6), 0 0 14px rgba(200, 140, 20, 0.4)',
        },
        '70%': {
            boxShadow: '0 0 12px rgba(255, 220, 80, 1.0), 0 0 24px rgba(232, 180, 40, 0.7), 0 0 36px rgba(180, 120, 10, 0.4)',
        },
        '85%': {
            boxShadow: '0 0 6px rgba(244, 200, 60, 0.6), 0 0 14px rgba(200, 140, 20, 0.4)',
        },
        '100%': {
            boxShadow: '0 0 6px rgba(64, 208, 255, 0.6), 0 0 14px rgba(10, 104, 200, 0.4)',
        },
    },
    animation: 'chipGlow 2.4s linear infinite',
    transition: 'box-shadow 0.3s ease-in-out',
});

export interface AttachedFile {
    name: string;
    path: string;
    type: string;
    size: number;
    isContextDoc?: boolean;
    enabled?: boolean;
}

interface FileAttachmentsListProps {
    files: AttachedFile[];
    glowingFile: string | null;
    onRemove: (filePath: string) => void;
    onToggleContextDoc: (filePath: string) => void;
}

export function FileAttachmentsList({
    files,
    glowingFile,
    onRemove,
    onToggleContextDoc,
}: FileAttachmentsListProps) {
    if (files.length === 0) return null;

    return (
        <AttachmentsContainer>
            {files.map((file) => {
                const isDisabled = file.isContextDoc && file.enabled === false;
                const isGlowing = glowingFile === file.path;
                const ChipComponent = isGlowing ? GlowingChip : Chip;

                return (
                    <ChipComponent
                        key={file.path}
                        label={file.name}
                        size="small"
                        title={file.path}
                        icon={file.isContextDoc ? (
                            isDisabled ? <VisibilityOffIcon fontSize="small" /> : <VisibilityIcon fontSize="small" />
                        ) : undefined}
                        onDelete={file.isContextDoc ? undefined : () => onRemove(file.path)}
                        onClick={file.isContextDoc ? () => onToggleContextDoc(file.path) : undefined}
                        sx={{
                            fontSize: '0.75rem',
                            cursor: file.isContextDoc ? 'pointer' : 'default',
                            opacity: isDisabled ? 0.5 : 1,
                            '& .MuiChip-label': {
                                color: isDisabled ? 'text.disabled' : 'text.primary',
                            },
                            '& .MuiChip-icon': {
                                color: isDisabled ? 'text.disabled' : 'primary.main',
                            },
                        }}
                    />
                );
            })}
        </AttachmentsContainer>
    );
}
