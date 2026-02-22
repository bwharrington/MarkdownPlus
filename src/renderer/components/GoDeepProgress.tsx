import React, { useEffect, useRef, useMemo } from 'react';
import { Box, Typography, Chip, styled, keyframes } from '@mui/material';
import type { GoDeepPhase, GoDeepProgress as GoDeepProgressData, GoDeepAnalysis } from '../hooks/useAIGoDeeper';
import { useEditLoadingMessage } from '../hooks/useEditLoadingMessage';

type StepStatus = 'pending' | 'active' | 'complete';

const PHASE_ORDER: Exclude<GoDeepPhase, 'complete' | null>[] = ['analyzing', 'expanding', 'integrating', 'finalizing'];

const PHASE_LABELS: Record<string, string> = {
    analyzing: 'Analyzing Report',
    expanding: 'Expanding Depth',
    integrating: 'Integrating Content',
    finalizing: 'Finalizing Document',
};

const ANALYZING_MESSAGES = [
    'Analyzing current report...',
    'Scanning for gaps and opportunities...',
    'Mapping expansion potential...',
    'Evaluating depth coverage...',
    'Identifying high-value topics...',
] as const;

const EXPANDING_MESSAGES = [
    'Expanding technical deep dive...',
    'Adding latest developments...',
    'Building advanced examples...',
    'Enriching with production insights...',
    'Deepening coverage...',
] as const;

const INTEGRATING_MESSAGES = [
    'Merging new insights...',
    'Weaving content together...',
    'Building cohesive narrative...',
    'Integrating addendums...',
    'Polishing transitions...',
] as const;

const FINALIZING_MESSAGES = [
    'Generating updated filename...',
    'Versioning the document...',
    'Preparing final output...',
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

const FileHeader = styled(Box)(({ theme }) => ({
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    padding: '6px 10px',
    marginBottom: 12,
    borderRadius: 4,
    backgroundColor: theme.palette.mode === 'dark'
        ? 'rgba(255,255,255,0.05)'
        : 'rgba(0,0,0,0.04)',
    border: `1px solid ${theme.palette.divider}`,
}));

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

// --- Helpers ---

function getMessagePool(phase: GoDeepPhase): readonly string[] {
    switch (phase) {
        case 'analyzing': return ANALYZING_MESSAGES;
        case 'expanding': return EXPANDING_MESSAGES;
        case 'integrating': return INTEGRATING_MESSAGES;
        case 'finalizing': return FINALIZING_MESSAGES;
        default: return ANALYZING_MESSAGES;
    }
}

function getStepStatus(phase: GoDeepPhase, stepPhase: string): StepStatus {
    if (phase === 'complete') return 'complete';
    const currentIndex = PHASE_ORDER.indexOf(phase as typeof PHASE_ORDER[number]);
    const stepIndex = PHASE_ORDER.indexOf(stepPhase as typeof PHASE_ORDER[number]);
    if (currentIndex < 0 || stepIndex < 0) return 'pending';
    if (stepIndex < currentIndex) return 'complete';
    if (stepIndex === currentIndex) return 'active';
    return 'pending';
}

function formatElapsed(ms: number): string {
    if (ms < 1000) return `${ms}ms`;
    return `${(ms / 1000).toFixed(1)}s`;
}

// --- Component ---

interface GoDeepProgressProps {
    goDeepPhase: GoDeepPhase;
    goDeepProgress: GoDeepProgressData | null;
    goDeepAnalysis: GoDeepAnalysis | null;
    fileName?: string;
}

export const GoDeepProgress = React.memo(function GoDeepProgress({
    goDeepPhase,
    goDeepProgress,
    goDeepAnalysis,
    fileName,
}: GoDeepProgressProps) {
    const isWorking = goDeepPhase !== null && goDeepPhase !== 'complete';
    const messagePool = useMemo(() => getMessagePool(goDeepPhase), [goDeepPhase]);
    const { displayText } = useEditLoadingMessage(isWorking, messagePool);

    // Track phase timings
    const timingsRef = useRef<Record<string, PhaseTiming>>({});
    const prevPhaseRef = useRef<GoDeepPhase>(null);

    useEffect(() => {
        const prev = prevPhaseRef.current;
        const curr = goDeepPhase;

        if (prev !== curr) {
            if (prev && prev !== 'complete' && timingsRef.current[prev] && !timingsRef.current[prev].end) {
                timingsRef.current[prev].end = Date.now();
            }
            if (curr && curr !== 'complete') {
                timingsRef.current[curr] = { start: Date.now() };
            }
            if (curr === 'analyzing' && prev !== 'analyzing') {
                timingsRef.current = {};
                timingsRef.current[curr] = { start: Date.now() };
            }
            prevPhaseRef.current = curr;
        }
    }, [goDeepPhase]);

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

    const isComplete = goDeepPhase === 'complete';
    const completeStatus: StepStatus = isComplete ? 'complete' : 'pending';

    return (
        <ProgressContainer>
            {fileName && (
                <FileHeader>
                    <Typography
                        variant="caption"
                        color="text.disabled"
                        sx={{ flexShrink: 0 }}
                    >
                        Deepening:
                    </Typography>
                    <Typography
                        variant="caption"
                        color="text.secondary"
                        sx={{
                            fontFamily: 'monospace',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                        }}
                        title={fileName}
                    >
                        {fileName}
                    </Typography>
                </FileHeader>
            )}
            {PHASE_ORDER.map((stepPhase) => {
                const status = getStepStatus(goDeepPhase, stepPhase);
                const label = PHASE_LABELS[stepPhase] || stepPhase;
                const elapsed = status === 'complete' ? getPhaseElapsed(stepPhase) : null;
                const isActive = status === 'active';

                let displayLabel = label;
                if (stepPhase === 'expanding' && goDeepProgress) {
                    displayLabel = `${label} (${goDeepProgress.current}/${goDeepProgress.total})`;
                }

                return (
                    <React.Fragment key={stepPhase}>
                        <StepRow>
                            <StepIndicatorColumn>
                                <StepDot status={status} />
                                <StepConnector status={status} />
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
                                {stepPhase === 'analyzing' && status === 'complete' && goDeepAnalysis && (
                                    <MetadataCard>
                                        <MetadataRow>
                                            <MetadataLabel>Focus</MetadataLabel>
                                            <Typography variant="caption" color="text.secondary">
                                                {goDeepAnalysis.newFocusAreas}
                                            </Typography>
                                        </MetadataRow>
                                        {goDeepAnalysis.newDeepDiveTopics.length > 0 && (
                                            <MetadataRow>
                                                <MetadataLabel>Topics</MetadataLabel>
                                                <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap' }}>
                                                    {goDeepAnalysis.newDeepDiveTopics.map((topic) => (
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
                                        <MetadataRow>
                                            <MetadataLabel>Depth</MetadataLabel>
                                            <Typography variant="caption" color="text.secondary" sx={{ textTransform: 'capitalize' }}>
                                                {goDeepAnalysis.suggestedDepthLevel}
                                            </Typography>
                                        </MetadataRow>
                                        {goDeepAnalysis.changelogIdeas.length > 0 && (
                                            <MetadataRow>
                                                <MetadataLabel>Changes</MetadataLabel>
                                                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
                                                    {goDeepAnalysis.changelogIdeas.map((idea, i) => (
                                                        <Typography key={i} variant="caption" color="text.secondary">
                                                            {idea}
                                                        </Typography>
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
                            Go Deeper Complete
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
