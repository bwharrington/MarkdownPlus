import React, { useState, useCallback, useMemo } from 'react';
import {
    Box,
    Button,
    Checkbox,
    FormControlLabel,
    Typography,
    styled,
} from '@mui/material';

// --- Styled components ---

const SelectorContainer = styled(Box)(({ theme }) => ({
    display: 'flex',
    flexDirection: 'column',
    gap: 12,
    padding: '12px 14px',
    borderRadius: 8,
    backgroundColor: theme.palette.mode === 'dark'
        ? 'rgba(255,255,255,0.04)'
        : 'rgba(0,0,0,0.03)',
    border: `1px solid ${theme.palette.divider}`,
    width: '100%',
    boxSizing: 'border-box',
}));

const SectionLabel = styled(Typography)(({ theme }) => ({
    fontSize: '0.7rem',
    fontWeight: 600,
    textTransform: 'uppercase',
    letterSpacing: '0.08em',
    color: theme.palette.text.disabled,
    marginBottom: 2,
}));

const TopicCheckbox = styled(FormControlLabel)({
    display: 'flex',
    width: '100%',
    marginLeft: 0,
    marginRight: 0,
    marginTop: 0,
    marginBottom: 0,
    alignItems: 'flex-start',
    '& .MuiFormControlLabel-label': {
        fontSize: '0.8rem',
        lineHeight: 1.4,
        paddingTop: '3px',
    },
    '& .MuiCheckbox-root': {
        padding: '2px 6px 2px 0',
        flexShrink: 0,
    },
});

const ContinueButton = styled(Button)({
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
    padding: '6px 20px',
    borderRadius: 8,
    alignSelf: 'flex-start',
    '&:not(.Mui-disabled)::before': {
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

interface GoDeepTopicSelectorProps {
    aiTopics: string[];
    documentTopics: string[];
    onContinue: (selectedTopics: string[]) => void;
    disabled?: boolean;
}

export const GoDeepTopicSelector = React.memo(function GoDeepTopicSelector({
    aiTopics,
    documentTopics,
    onContinue,
    disabled = false,
}: GoDeepTopicSelectorProps) {
    // AI topics: all checked by default
    const [selectedAiTopics, setSelectedAiTopics] = useState<Set<string>>(
        () => new Set(aiTopics)
    );
    // Document topics: all unchecked by default
    const [selectedDocTopics, setSelectedDocTopics] = useState<Set<string>>(
        () => new Set<string>()
    );

    const toggleAiTopic = useCallback((topic: string) => {
        setSelectedAiTopics(prev => {
            const next = new Set(prev);
            if (next.has(topic)) {
                next.delete(topic);
            } else {
                next.add(topic);
            }
            return next;
        });
    }, []);

    const toggleDocTopic = useCallback((topic: string) => {
        setSelectedDocTopics(prev => {
            const next = new Set(prev);
            if (next.has(topic)) {
                next.delete(topic);
            } else {
                next.add(topic);
            }
            return next;
        });
    }, []);

    const selectedTopics = useMemo(() => [
        ...aiTopics.filter(t => selectedAiTopics.has(t)),
        ...documentTopics.filter(t => selectedDocTopics.has(t)),
    ], [aiTopics, documentTopics, selectedAiTopics, selectedDocTopics]);

    const handleContinue = useCallback(() => {
        if (selectedTopics.length > 0) {
            onContinue(selectedTopics);
        }
    }, [selectedTopics, onContinue]);

    const hasSelection = selectedTopics.length > 0;

    return (
        <SelectorContainer>
            {aiTopics.length > 0 && (
                <Box>
                    <SectionLabel>AI-Suggested Topics</SectionLabel>
                    {aiTopics.map(topic => (
                        <TopicCheckbox
                            key={topic}
                            control={
                                <Checkbox
                                    size="small"
                                    checked={selectedAiTopics.has(topic)}
                                    onChange={() => toggleAiTopic(topic)}
                                    disabled={disabled}
                                />
                            }
                            label={topic}
                        />
                    ))}
                </Box>
            )}

            {documentTopics.length > 0 && (
                <Box>
                    <SectionLabel>Document Topics</SectionLabel>
                    {documentTopics.map(topic => (
                        <TopicCheckbox
                            key={topic}
                            control={
                                <Checkbox
                                    size="small"
                                    checked={selectedDocTopics.has(topic)}
                                    onChange={() => toggleDocTopic(topic)}
                                    disabled={disabled}
                                />
                            }
                            label={topic}
                        />
                    ))}
                </Box>
            )}

            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mt: 1 }}>
                <ContinueButton
                    variant="contained"
                    color="primary"
                    disabled={disabled || !hasSelection}
                    onClick={handleContinue}
                >
                    Continue with {selectedTopics.length} topic{selectedTopics.length !== 1 ? 's' : ''}
                </ContinueButton>
                {!hasSelection && (
                    <Typography variant="caption" color="text.disabled">
                        Select at least one topic
                    </Typography>
                )}
            </Box>
        </SelectorContainer>
    );
});
