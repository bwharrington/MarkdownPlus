import React, { useEffect, useRef, useMemo } from 'react';
import { Box, Typography, styled, keyframes } from '@mui/material';
import type { AskPhase } from '../hooks/useAIAsk';
import type { WebSearchPhase } from '../hooks/useWebSearch';
import { useEditLoadingMessage } from '../hooks/useEditLoadingMessage';

type StepStatus = 'pending' | 'active' | 'complete';

const OPTIMIZING_MESSAGES = [
    'Optimizing search query...',
    'Refining your question...',
    'Crafting the perfect query...',
    'Analyzing intent...',
    'Tuning search terms...',
] as const;

const SEARCHING_MESSAGES = [
    'Searching the web...',
    'Looking up recent results...',
    'Fetching live context...',
    'Scanning relevant pages...',
    'Pulling fresh data...',
] as const;

const ANSWERING_MESSAGES = [
    'Composing your answer...',
    'Thinking it through...',
    'Processing context...',
    'Formulating a response...',
    'Connecting the dots...',
    'Crafting a concise reply...',
] as const;

interface PhaseTiming {
    start: number;
    end?: number;
}

// --- Styled components (same pattern as CreateProgress) ---

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
        backgroundColor: theme.palette.primary.main,
        animation: `${pulse} 1.5s ease-in-out infinite`,
        boxShadow: `0 0 8px ${theme.palette.primary.main}`,
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

// --- Component ---

interface AskProgressProps {
    askPhase: AskPhase;
    webSearchPhase: WebSearchPhase;
    webSearchEnabled: boolean;
}

type ActiveStep = 'optimizing' | 'searching' | 'answering';

function getMessagePool(step: ActiveStep): readonly string[] {
    switch (step) {
        case 'optimizing': return OPTIMIZING_MESSAGES;
        case 'searching':  return SEARCHING_MESSAGES;
        case 'answering':  return ANSWERING_MESSAGES;
        default:           return ANSWERING_MESSAGES;
    }
}

function getActiveStep(webSearchPhase: WebSearchPhase, askPhase: AskPhase): ActiveStep | null {
    if (webSearchPhase === 'optimizing') return 'optimizing';
    if (webSearchPhase === 'searching') return 'searching';
    if (askPhase === 'answering') return 'answering';
    return null;
}

function getStepStatus(step: ActiveStep, webSearchPhase: WebSearchPhase, askPhase: AskPhase, webSearchEnabled: boolean): StepStatus {
    if (step === 'optimizing') {
        if (!webSearchEnabled) return 'pending';
        if (webSearchPhase === 'optimizing') return 'active';
        if (webSearchPhase === 'searching' || (webSearchPhase === null && askPhase === 'answering')) return 'complete';
        return 'pending';
    }
    if (step === 'searching') {
        if (!webSearchEnabled) return 'pending';
        if (webSearchPhase === 'optimizing') return 'pending';
        if (webSearchPhase === 'searching') return 'active';
        if (webSearchPhase === null && askPhase === 'answering') return 'complete';
        return 'pending';
    }
    // step === 'answering'
    if (askPhase === 'answering') return 'active';
    if (webSearchPhase !== null) return 'pending';
    return 'pending';
}

function formatElapsed(ms: number): string {
    if (ms < 1000) return `${ms}ms`;
    return `${(ms / 1000).toFixed(1)}s`;
}

export const AskProgress = React.memo(function AskProgress({
    askPhase,
    webSearchPhase,
    webSearchEnabled,
}: AskProgressProps) {
    const activeStep = getActiveStep(webSearchPhase, askPhase);
    const isWorking = activeStep !== null;
    const messagePool = useMemo(
        () => getMessagePool(activeStep ?? 'answering'),
        [activeStep],
    );
    const { displayText } = useEditLoadingMessage(isWorking, messagePool);

    const timingsRef = useRef<Record<string, PhaseTiming>>({});
    const prevStepRef = useRef<ActiveStep | null>(null);

    useEffect(() => {
        const prev = prevStepRef.current;
        const curr = activeStep;

        if (prev !== curr) {
            if (prev && timingsRef.current[prev] && !timingsRef.current[prev].end) {
                timingsRef.current[prev].end = Date.now();
            }
            if (curr) {
                // Reset timings at the start of a fresh request
                if (curr === 'optimizing' || (curr === 'answering' && !webSearchEnabled)) {
                    timingsRef.current = {};
                }
                timingsRef.current[curr] = { start: Date.now() };
            }
            prevStepRef.current = curr;
        }
    }, [activeStep, webSearchEnabled]);

    const getPhaseElapsed = (phase: string): string | null => {
        const timing = timingsRef.current[phase];
        if (!timing || !timing.end) return null;
        return formatElapsed(timing.end - timing.start);
    };

    const steps: Array<{ key: ActiveStep; label: string }> = [
        ...(webSearchEnabled ? [
            { key: 'optimizing' as ActiveStep, label: 'Optimizing Query' },
            { key: 'searching' as ActiveStep, label: 'Searching the Web' },
        ] : []),
        { key: 'answering', label: 'Getting Answer' },
    ];

    return (
        <ProgressContainer>
            {steps.map((step, index) => {
                const status = getStepStatus(step.key, webSearchPhase, askPhase, webSearchEnabled);
                const elapsed = status === 'complete' ? getPhaseElapsed(step.key) : null;
                const isActive = status === 'active';
                const isLast = index === steps.length - 1;

                return (
                    <React.Fragment key={step.key}>
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
                                        {step.label}
                                    </Typography>
                                    {elapsed && <TimeBadge>{elapsed}</TimeBadge>}
                                </StepLabelRow>
                                {isActive && (
                                    <TypewriterText>
                                        {displayText}
                                        <LoadingCursor />
                                    </TypewriterText>
                                )}
                            </StepContent>
                        </StepRow>
                    </React.Fragment>
                );
            })}
        </ProgressContainer>
    );
});
