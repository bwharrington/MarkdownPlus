import React, { useEffect, useRef, useMemo } from 'react';
import { Box, Typography, styled, keyframes } from '@mui/material';
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

const EDITING_MESSAGES = [
    'Applying edits...',
    'Rewriting content...',
    'Making changes...',
    'Updating the document...',
    'Refining the text...',
    'Processing modifications...',
] as const;

interface PhaseTiming {
    start: number;
    end?: number;
}

// --- Styled components (same pattern as AskProgress / CreateProgress) ---

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
        backgroundColor: theme.palette.success.main,
        animation: `${pulse} 1.5s ease-in-out infinite`,
        boxShadow: `0 0 8px ${theme.palette.success.main}`,
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

type ActiveStep = 'optimizing' | 'searching' | 'editing';

interface EditProgressProps {
    webSearchPhase: WebSearchPhase;
    webSearchEnabled: boolean;
    isEditing: boolean; // true when the actual edit API call is in flight
}

function getMessagePool(step: ActiveStep): readonly string[] {
    switch (step) {
        case 'optimizing': return OPTIMIZING_MESSAGES;
        case 'searching':  return SEARCHING_MESSAGES;
        case 'editing':    return EDITING_MESSAGES;
        default:           return EDITING_MESSAGES;
    }
}

function getActiveStep(webSearchPhase: WebSearchPhase, isEditing: boolean): ActiveStep | null {
    if (webSearchPhase === 'optimizing') return 'optimizing';
    if (webSearchPhase === 'searching') return 'searching';
    if (isEditing) return 'editing';
    return null;
}

function getStepStatus(step: ActiveStep, webSearchPhase: WebSearchPhase, isEditing: boolean, webSearchEnabled: boolean): StepStatus {
    if (step === 'optimizing') {
        if (!webSearchEnabled) return 'pending';
        if (webSearchPhase === 'optimizing') return 'active';
        if (webSearchPhase === 'searching' || (webSearchPhase === null && isEditing)) return 'complete';
        return 'pending';
    }
    if (step === 'searching') {
        if (!webSearchEnabled) return 'pending';
        if (webSearchPhase === 'optimizing') return 'pending';
        if (webSearchPhase === 'searching') return 'active';
        if (webSearchPhase === null && isEditing) return 'complete';
        return 'pending';
    }
    // step === 'editing'
    if (isEditing && webSearchPhase === null) return 'active';
    if (webSearchPhase !== null) return 'pending';
    return 'pending';
}

function formatElapsed(ms: number): string {
    if (ms < 1000) return `${ms}ms`;
    return `${(ms / 1000).toFixed(1)}s`;
}

export const EditProgress = React.memo(function EditProgress({
    webSearchPhase,
    webSearchEnabled,
    isEditing,
}: EditProgressProps) {
    const activeStep = getActiveStep(webSearchPhase, isEditing);
    const isWorking = activeStep !== null;
    const messagePool = useMemo(
        () => getMessagePool(activeStep ?? 'editing'),
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
                if (curr === 'optimizing' || (curr === 'editing' && !webSearchEnabled)) {
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
        { key: 'editing' as ActiveStep, label: 'Applying Edits' },
    ];

    return (
        <ProgressContainer>
            {steps.map((step, index) => {
                const status = getStepStatus(step.key, webSearchPhase, isEditing, webSearchEnabled);
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
