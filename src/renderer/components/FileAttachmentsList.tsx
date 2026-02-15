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
        '0%, 100%': {
            boxShadow: '0 0 2px rgba(33, 150, 243, 0.3)',
        },
        '50%': {
            boxShadow: '0 0 12px rgba(33, 150, 243, 0.8), 0 0 20px rgba(33, 150, 243, 0.4)',
        },
    },
    animation: 'chipGlow 1.5s ease-in-out infinite',
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
