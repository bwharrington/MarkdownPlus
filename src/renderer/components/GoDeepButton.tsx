import React from 'react';
import { Box, Button, Typography, Tooltip, styled, Select, MenuItem, FormControl, InputLabel } from '@mui/material';
import type { GoDeepDepthLevel } from '../hooks/useAIGoDeeper';

// --- Styled components ---

const GoDeepButtonContainer = styled(Box)({
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    padding: '12px 0',
    gap: 8,
    width: '100%',
});

const TargetFileLabel = styled(Box)(({ theme }) => ({
    display: 'flex',
    alignItems: 'center',
    gap: 4,
    padding: '4px 10px',
    borderRadius: 4,
    backgroundColor: theme.palette.mode === 'dark'
        ? 'rgba(255,255,255,0.05)'
        : 'rgba(0,0,0,0.04)',
    border: `1px solid ${theme.palette.divider}`,
    // Fills available width but respects container padding
    width: '100%',
    maxWidth: 320,
    boxSizing: 'border-box',
    minWidth: 0,
}));

const AnimatedButton = styled(Button)({
    '@keyframes goDeepBorderSpin': {
        '0%':   { '--gd-border-angle': '0deg' },
        '100%': { '--gd-border-angle': '360deg' },
    },
    '@property --gd-border-angle': {
        syntax: '"<angle>"',
        inherits: 'false',
        initialValue: '0deg',
    },
    position: 'relative',
    overflow: 'visible',
    zIndex: 0,
    fontWeight: 600,
    textTransform: 'none',
    padding: '8px 24px',
    borderRadius: 8,
    '&::before': {
        content: '""',
        position: 'absolute',
        inset: -2,
        borderRadius: 10,
        padding: '2px',
        background: 'conic-gradient(from var(--gd-border-angle), #0A68C8, #40D0FF, #78E8FF, #FFFFFF, #F4D878, #E8B830, #C8810A, #E8B830, #F4D878, #FFFFFF, #78E8FF, #40D0FF, #0A68C8)',
        WebkitMask: 'linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0)',
        WebkitMaskComposite: 'xor',
        maskComposite: 'exclude',
        animation: 'goDeepBorderSpin 2s linear infinite',
        zIndex: -1,
    },
});

// --- Component ---

interface GoDeepButtonProps {
    onClick: () => void;
    fileName?: string;
    disabled?: boolean;
    depthLevel?: GoDeepDepthLevel;
    onDepthLevelChange?: (level: GoDeepDepthLevel) => void;
}

export const GoDeepButton = React.memo(function GoDeepButton({
    onClick,
    fileName,
    disabled = false,
    depthLevel = 'practitioner',
    onDepthLevelChange,
}: GoDeepButtonProps) {
    return (
        <GoDeepButtonContainer>
            <FormControl size="small" sx={{ width: '100%', maxWidth: 320 }}>
                <InputLabel id="go-deep-depth-label">Depth</InputLabel>
                <Select
                    labelId="go-deep-depth-label"
                    label="Depth"
                    value={depthLevel}
                    onChange={(e) => onDepthLevelChange?.(e.target.value as GoDeepDepthLevel)}
                    disabled={disabled}
                >
                    <MenuItem value="beginner">Beginner</MenuItem>
                    <MenuItem value="practitioner">Practitioner</MenuItem>
                    <MenuItem value="expert">Expert</MenuItem>
                </Select>
            </FormControl>
            <AnimatedButton
                variant="contained"
                color="primary"
                onClick={onClick}
                disabled={disabled}
            >
                Go Deeper
            </AnimatedButton>
            <Typography
                variant="caption"
                color="text.secondary"
                sx={{ textAlign: 'center', maxWidth: 280 }}
            >
                Deepen and expand this research with additional insights
            </Typography>
            {fileName && (
                <Tooltip title={fileName} placement="top" enterDelay={400}>
                    <TargetFileLabel>
                        <Typography
                            variant="caption"
                            color="text.disabled"
                            sx={{ flexShrink: 0 }}
                        >
                            Target:
                        </Typography>
                        <Typography
                            variant="caption"
                            color="text.secondary"
                            sx={{
                                fontFamily: 'monospace',
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                                whiteSpace: 'nowrap',
                                minWidth: 0,
                                flex: 1,
                            }}
                        >
                            {fileName}
                        </Typography>
                    </TargetFileLabel>
                </Tooltip>
            )}
        </GoDeepButtonContainer>
    );
});
