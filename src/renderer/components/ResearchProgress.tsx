import React, { useEffect, useRef, useMemo } from 'react';
import { Box, Typography, Chip, styled, keyframes } from '@mui/material';
import type { ResearchPhase, DeepeningProgress, InferenceResult } from '../hooks/useAIResearch';
import { useEditLoadingMessage } from '../hooks/useEditLoadingMessage';

type StepStatus = 'pending' | 'active' | 'complete';

const PHASE_ORDER: ResearchPhase[] = ['inference', 'researching', 'deepening', 'naming'];

const PHASE_LABELS: Record<string, string> = {
    inference: 'Analyzing Topic',
    researching: 'Compiling Report',
    deepening: 'Expanding Depth',
    naming: 'Generating Filename',
};

const INFERENCE_MESSAGES = [
    'Analyzing your topic...',
    'Identifying key research angles...',
    'Mapping the knowledge landscape...',
    'Determining target audience...',
    'Scoping the research territory...',
] as const;

const RESEARCHING_MESSAGES = [
    'Compiling research report...',
    'Synthesizing findings...',
    'Building executive summary...',
    'Analyzing current landscape...',
    'Evaluating key debates...',
    'Writing implementation guide...',
    'Surveying the state of the art...',
    'Cross-referencing sources...',
] as const;

const DEEPENING_MESSAGES = [
    'Expanding technical deep dive...',
    'Adding code examples and patterns...',
    'Detailing edge cases and pitfalls...',
    'Exploring advanced patterns...',
    'Enriching implementation details...',
] as const;

const NAMING_MESSAGES = [
    'Generating filename...',
    'Picking the perfect title...',
    'Naming your report...',
] as const;

interface PhaseTiming {
    start: number;
    end?: number;
}

// --- Styled components ---

const pulse = keyframes`
    0%, 100% { opacity: 1; transform: scale(1); }
    50% { opacity: 0.6; transform: scale(1.15); }
`;

const ProgressContainer = styled(Box)({
    display: 'flex',
    flexDirection: 'column',
    padding: '16px 12px',
    gap: 0,
});

const StepRow = styled(Box)({
    display: 'flex',
    flexDirection: 'row',
    alignItems: 'stretch',
    gap: 12,
});

const StepIndicatorColumn = styled(Box)({
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    width: 20,
    flexShrink: 0,
});

const StepDot = styled(Box)<{ status: StepStatus }>(({ theme, status }) => ({
    width: 12,
    height: 12,
    borderRadius: '50%',
    flexShrink: 0,
    ...(status === 'pending' && {
        backgroundColor: theme.palette.mode === 'dark'
            ? theme.palette.grey[700]
            : theme.palette.grey[400],
    }),
    ...(status === 'active' && {
        backgroundColor: theme.palette.info.main,
        animation: `${pulse} 1.5s ease-in-out infinite`,
        boxShadow: `0 0 8px ${theme.palette.info.main}`,
    }),
    ...(status === 'complete' && {
        backgroundColor: theme.palette.success.main,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: 9,
        color: theme.palette.success.contrastText,
        '&::after': {
            content: '"\\2713"',
        },
    }),
}));

const StepConnector = styled(Box)<{ status: StepStatus }>(({ theme, status }) => ({
    width: 2,
    flex: 1,
    minHeight: 8,
    backgroundColor: status === 'complete'
        ? theme.palette.success.main
        : theme.palette.mode === 'dark'
            ? theme.palette.grey[700]
            : theme.palette.grey[300],
}));

const StepContent = styled(Box)({
    display: 'flex',
    flexDirection: 'column',
    gap: 4,
    paddingBottom: 8,
    minWidth: 0,
    flex: 1,
});

const StepLabelRow = styled(Box)({
    display: 'flex',
    alignItems: 'center',
    gap: 8,
});

const TimeBadge = styled(Typography)(({ theme }) => ({
    fontSize: '0.7rem',
    color: theme.palette.text.disabled,
    fontFamily: 'monospace',
}));

const TypewriterText = styled(Typography)(({ theme }) => ({
    fontFamily: 'monospace',
    fontSize: '0.8rem',
    color: theme.palette.text.secondary,
    minHeight: '1.2em',
}));

const LoadingCursor = styled('span')(({ theme }) => ({
    display: 'inline-block',
    width: '2px',
    height: '1em',
    backgroundColor: theme.palette.text.secondary,
    marginLeft: '1px',
    verticalAlign: 'text-bottom',
    '@keyframes blink': {
        '0%, 100%': { opacity: 1 },
        '50%': { opacity: 0 },
    },
    animation: 'blink 1s step-end infinite',
}));

const MetadataCard = styled(Box)(({ theme }) => ({
    marginTop: 4,
    padding: '8px 10px',
    borderRadius: 6,
    border: `1px solid ${theme.palette.divider}`,
    backgroundColor: theme.palette.mode === 'dark'
        ? 'rgba(255,255,255,0.03)'
        : 'rgba(0,0,0,0.02)',
    display: 'flex',
    flexDirection: 'column',
    gap: 6,
}));

const MetadataRow = styled(Box)({
    display: 'flex',
    alignItems: 'flex-start',
    gap: 6,
    flexWrap: 'wrap',
});

const MetadataLabel = styled(Typography)(({ theme }) => ({
    fontSize: '0.7rem',
    fontWeight: 600,
    color: theme.palette.text.disabled,
    textTransform: 'uppercase',
    minWidth: 55,
    flexShrink: 0,
}));

// --- Component ---

interface ResearchProgressProps {
    researchPhase: ResearchPhase;
    deepeningProgress: DeepeningProgress | null;
    inferenceResult: InferenceResult | null;
}

function getMessagePool(phase: ResearchPhase): readonly string[] {
    switch (phase) {
        case 'inference': return INFERENCE_MESSAGES;
        case 'researching': return RESEARCHING_MESSAGES;
        case 'deepening': return DEEPENING_MESSAGES;
        case 'naming': return NAMING_MESSAGES;
        default: return RESEARCHING_MESSAGES;
    }
}

function getStepStatus(phase: ResearchPhase, stepPhase: ResearchPhase): StepStatus {
    // When complete, all working phases are complete
    if (phase === 'complete') return 'complete';
    const currentIndex = PHASE_ORDER.indexOf(phase);
    const stepIndex = PHASE_ORDER.indexOf(stepPhase);
    if (currentIndex < 0 || stepIndex < 0) return 'pending';
    if (stepIndex < currentIndex) return 'complete';
    if (stepIndex === currentIndex) return 'active';
    return 'pending';
}

function formatElapsed(ms: number): string {
    if (ms < 1000) return `${ms}ms`;
    return `${(ms / 1000).toFixed(1)}s`;
}

export const ResearchProgress = React.memo(function ResearchProgress({
    researchPhase,
    deepeningProgress,
    inferenceResult,
}: ResearchProgressProps) {
    const isWorking = researchPhase !== null && researchPhase !== 'complete';
    const messagePool = useMemo(() => getMessagePool(researchPhase), [researchPhase]);
    const { displayText } = useEditLoadingMessage(isWorking, messagePool);

    // Track phase timings
    const timingsRef = useRef<Record<string, PhaseTiming>>({});
    const prevPhaseRef = useRef<ResearchPhase>(null);

    useEffect(() => {
        const prev = prevPhaseRef.current;
        const curr = researchPhase;

        if (prev !== curr) {
            // End previous phase timing
            if (prev && prev !== 'complete' && timingsRef.current[prev] && !timingsRef.current[prev].end) {
                timingsRef.current[prev].end = Date.now();
            }
            // Start new phase timing (don't start a timing for 'complete')
            if (curr && curr !== 'complete') {
                timingsRef.current[curr] = { start: Date.now() };
            }
            // Reset timings when starting a new research
            if (curr === 'inference' && prev !== 'inference') {
                timingsRef.current = {};
                timingsRef.current[curr] = { start: Date.now() };
            }
            prevPhaseRef.current = curr;
        }
    }, [researchPhase]);

    const getPhaseElapsed = (phase: string): string | null => {
        const timing = timingsRef.current[phase];
        if (!timing) return null;
        if (timing.end) return formatElapsed(timing.end - timing.start);
        return null;
    };

    const getTotalElapsed = (): string | null => {
        const entries = Object.values(timingsRef.current);
        if (entries.length === 0) return null;
        const firstStart = Math.min(...entries.map(t => t.start));
        const lastEnd = Math.max(...entries.filter(t => t.end).map(t => t.end!));
        if (!lastEnd) return null;
        return formatElapsed(lastEnd - firstStart);
    };

    const isComplete = researchPhase === 'complete';
    const completeStatus: StepStatus = isComplete ? 'complete' : 'pending';

    return (
        <ProgressContainer>
            {PHASE_ORDER.map((stepPhase, index) => {
                const status = getStepStatus(researchPhase, stepPhase);
                const label = PHASE_LABELS[stepPhase!] || stepPhase;
                const elapsed = status === 'complete' ? getPhaseElapsed(stepPhase!) : null;
                const isActive = status === 'active';
                const isLast = false; // Never last — "Complete" step follows

                // Build label with deepening progress
                let displayLabel = label;
                if (stepPhase === 'deepening' && deepeningProgress) {
                    displayLabel = `${label} (${deepeningProgress.current}/${deepeningProgress.total})`;
                } else if (stepPhase === 'deepening' && status === 'pending') {
                    displayLabel = `${label}`;
                }

                return (
                    <React.Fragment key={stepPhase}>
                        <StepRow>
                            <StepIndicatorColumn>
                                <StepDot status={status} />
                                {!isLast && <StepConnector status={status} />}
                            </StepIndicatorColumn>
                            <StepContent>
                                <StepLabelRow>
                                    <Typography
                                        variant="body2"
                                        sx={{
                                            fontWeight: isActive ? 600 : 400,
                                            opacity: status === 'pending' ? 0.5 : 1,
                                        }}
                                    >
                                        {displayLabel}
                                    </Typography>
                                    {elapsed && <TimeBadge>{elapsed}</TimeBadge>}
                                </StepLabelRow>
                                {isActive && (
                                    <TypewriterText>
                                        {displayText}
                                        <LoadingCursor />
                                    </TypewriterText>
                                )}
                                {stepPhase === 'inference' && status === 'complete' && inferenceResult && (
                                    <MetadataCard>
                                        <MetadataRow>
                                            <MetadataLabel>Audience</MetadataLabel>
                                            <Typography variant="caption" color="text.secondary">
                                                {inferenceResult.audience}
                                            </Typography>
                                        </MetadataRow>
                                        <MetadataRow>
                                            <MetadataLabel>Fields</MetadataLabel>
                                            <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap' }}>
                                                {inferenceResult.fields.map((field) => (
                                                    <Chip
                                                        key={field}
                                                        label={field}
                                                        size="small"
                                                        variant="outlined"
                                                        sx={{ height: 20, fontSize: '0.7rem' }}
                                                    />
                                                ))}
                                            </Box>
                                        </MetadataRow>
                                        {inferenceResult.deepDiveTopics.length > 0 && (
                                            <MetadataRow>
                                                <MetadataLabel>Topics</MetadataLabel>
                                                <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap' }}>
                                                    {inferenceResult.deepDiveTopics.map((topic) => (
                                                        <Chip
                                                            key={topic}
                                                            label={topic}
                                                            size="small"
                                                            color="info"
                                                            variant="outlined"
                                                            sx={{ height: 20, fontSize: '0.7rem' }}
                                                        />
                                                    ))}
                                                </Box>
                                            </MetadataRow>
                                        )}
                                    </MetadataCard>
                                )}
                            </StepContent>
                        </StepRow>
                    </React.Fragment>
                );
            })}
            {/* Final "Complete" step */}
            <StepRow>
                <StepIndicatorColumn>
                    <StepDot status={completeStatus} />
                </StepIndicatorColumn>
                <StepContent>
                    <StepLabelRow>
                        <Typography
                            variant="body2"
                            sx={{
                                fontWeight: isComplete ? 600 : 400,
                                opacity: isComplete ? 1 : 0.5,
                                color: isComplete ? 'success.main' : undefined,
                            }}
                        >
                            Research Complete
                        </Typography>
                        {isComplete && getTotalElapsed() && (
                            <TimeBadge>{getTotalElapsed()}</TimeBadge>
                        )}
                    </StepLabelRow>
                </StepContent>
            </StepRow>
        </ProgressContainer>
    );
});
