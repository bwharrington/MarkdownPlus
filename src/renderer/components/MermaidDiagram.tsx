import React, { useEffect, useRef, useState } from 'react';
import { Box, styled, useTheme as useMuiTheme } from '@mui/material';
import mermaid from 'mermaid';

const MermaidContainer = styled(Box)(({ theme }) => ({
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
    margin: '16px 0',
    backgroundColor: theme.palette.mode === 'dark' ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.02)',
    borderRadius: 8,
    border: `1px solid ${theme.palette.divider}`,
    overflow: 'auto',
    '& svg': {
        maxWidth: '100%',
        height: 'auto',
    },
}));

const ErrorContainer = styled(Box)(({ theme }) => ({
    padding: 16,
    margin: '16px 0',
    backgroundColor: theme.palette.mode === 'dark' ? 'rgba(244, 67, 54, 0.1)' : 'rgba(244, 67, 54, 0.05)',
    borderRadius: 8,
    border: `1px solid ${theme.palette.error.main}`,
    color: theme.palette.error.main,
    fontFamily: 'Consolas, Monaco, "Courier New", monospace',
    fontSize: 12,
    whiteSpace: 'pre-wrap',
}));

interface MermaidDiagramProps {
    chart: string;
}

// Counter for generating unique IDs
let mermaidIdCounter = 0;

export const MermaidDiagram: React.FC<MermaidDiagramProps> = ({ chart }) => {
    const containerRef = useRef<HTMLDivElement>(null);
    const [error, setError] = useState<string | null>(null);
    const [svg, setSvg] = useState<string>('');
    const idRef = useRef<string>(`mermaid-diagram-${mermaidIdCounter++}`);
    const muiTheme = useMuiTheme();

    useEffect(() => {
        const renderDiagram = async () => {
            if (!chart.trim()) {
                setError('Empty diagram definition');
                return;
            }

            try {
                // Configure mermaid theme based on current MUI theme mode
                const mermaidTheme = muiTheme.palette.mode === 'dark' ? 'dark' : 'default';
                mermaid.initialize({
                    startOnLoad: false,
                    theme: mermaidTheme,
                    securityLevel: 'loose',
                    fontFamily: 'inherit',
                });

                // Validate the diagram syntax first
                const isValid = await mermaid.parse(chart);
                
                if (isValid) {
                    // Generate a unique ID for each render
                    const uniqueId = `${idRef.current}-${Date.now()}`;
                    const { svg: renderedSvg } = await mermaid.render(uniqueId, chart);
                    setSvg(renderedSvg);
                    setError(null);
                }
            } catch (err) {
                const errorMessage = err instanceof Error ? err.message : 'Failed to render Mermaid diagram';
                setError(errorMessage);
                setSvg('');
            }
        };

        renderDiagram();
    }, [chart, muiTheme.palette.mode]);

    if (error) {
        return (
            <ErrorContainer>
                <strong>Mermaid Diagram Error:</strong>
                <br />
                {error}
                <br />
                <br />
                <em>Original code:</em>
                <pre style={{ marginTop: 8 }}>{chart}</pre>
            </ErrorContainer>
        );
    }

    return (
        <MermaidContainer
            ref={containerRef}
            dangerouslySetInnerHTML={{ __html: svg }}
        />
    );
};

export default MermaidDiagram;
