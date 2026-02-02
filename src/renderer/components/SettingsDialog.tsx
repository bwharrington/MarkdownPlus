import React, { useState, useEffect, useRef } from 'react';
import {
    Box,
    Typography,
    IconButton,
    Select,
    MenuItem,
    FormControl,
    InputLabel,
    FormHelperText,
    Switch,
    FormControlLabel,
    Checkbox,
    Table,
    TableBody,
    TableCell,
    TableContainer,
    TableHead,
    TableRow,
    Paper,
    Chip,
    Accordion,
    AccordionSummary,
    AccordionDetails,
    Modal,
    Backdrop,
    styled,
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import DragIndicatorIcon from '@mui/icons-material/DragIndicator';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';

import { useSettingsConfig } from '../hooks/useSettingsConfig';
import { IConfig, IFileReference, AIProviderStatuses } from '../types/global';

// Styled Components
const DialogContainer = styled(Box)(({ theme }) => ({
    position: 'absolute',
    zIndex: 1000,
    backgroundColor: theme.palette.background.paper,
    border: `1px solid ${theme.palette.divider}`,
    borderRadius: 4,
    boxShadow: theme.shadows[8],
    minWidth: 500,
    maxWidth: 600,
    maxHeight: '80vh',
    overflow: 'hidden',
    display: 'flex',
    flexDirection: 'column',
}));

const DragHandle = styled(Box)(({ theme }) => ({
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '8px 16px',
    cursor: 'move',
    backgroundColor: theme.palette.action.hover,
    borderBottom: `1px solid ${theme.palette.divider}`,
    '&:hover': {
        backgroundColor: theme.palette.action.selected,
    },
}));

const DialogContent = styled(Box)({
    flex: 1,
    overflowY: 'auto',
    padding: 16,
});

const SectionHeader = styled(Typography)(({ theme }) => ({
    fontSize: 14,
    fontWeight: 600,
    color: theme.palette.text.secondary,
    marginBottom: 12,
    marginTop: 16,
    '&:first-of-type': {
        marginTop: 0,
    },
}));

// Helper to format model IDs (e.g., "grok-beta" -> "Grok Beta")
function formatModelName(modelId: string): string {
    return modelId
        .replace(/-/g, ' ')
        .replace(/\b\w/g, c => c.toUpperCase());
}

// Sub-component: AI Provider Section
interface AIProviderSectionProps {
    title: string;
    provider: 'xai' | 'claude' | 'openai';
    config: IConfig | null;
    onModelToggle: (provider: 'xai' | 'claude' | 'openai', modelId: string, enabled: boolean) => void;
    expanded: boolean;
    onToggle: () => void;
}

function AIProviderSection({ title, provider, config, onModelToggle, expanded, onToggle }: AIProviderSectionProps) {
    const providerConfig = config?.aiModels?.[provider];

    if (!providerConfig || Object.keys(providerConfig).length === 0) {
        return null; // No models configured for this provider
    }

    // Get all models for this provider
    const models = Object.entries(providerConfig).map(([modelId, modelConfig]) => ({
        id: modelId,
        enabled: modelConfig.enabled
    }));

    return (
        <Accordion
            expanded={expanded}
            onChange={onToggle}
            sx={{ mb: 1, '&:before': { display: 'none' } }}
            disableGutters
        >
            <AccordionSummary
                expandIcon={<ExpandMoreIcon />}
                sx={{
                    minHeight: 40,
                    '&.Mui-expanded': { minHeight: 40 },
                    '& .MuiAccordionSummary-content': { margin: '8px 0' },
                }}
            >
                <Typography sx={{ fontSize: 14, fontWeight: 600 }}>{title}</Typography>
            </AccordionSummary>
            <AccordionDetails sx={{ pt: 0, pb: 1 }}>
                <Box>
                    {models.map((model) => (
                        <FormControlLabel
                            key={model.id}
                            control={
                                <Checkbox
                                    checked={model.enabled}
                                    onChange={(e) => onModelToggle(provider, model.id, e.target.checked)}
                                    size="small"
                                />
                            }
                            label={formatModelName(model.id)}
                            sx={{ display: 'block', mb: 0.5 }}
                        />
                    ))}
                </Box>
            </AccordionDetails>
        </Accordion>
    );
}

// Sub-component: Files Table
interface FilesTableProps {
    files: IFileReference[];
}

function FilesTable({ files }: FilesTableProps) {
    if (files.length === 0) {
        return (
            <Box sx={{ p: 2, textAlign: 'center', color: 'text.secondary', fontSize: 14 }}>
                No files
            </Box>
        );
    }

    return (
        <TableContainer component={Paper} variant="outlined" sx={{ mb: 2 }}>
            <Table size="small">
                <TableHead>
                    <TableRow>
                        <TableCell>File Name</TableCell>
                        <TableCell>Mode</TableCell>
                    </TableRow>
                </TableHead>
                <TableBody>
                    {files.map((file, index) => (
                        <TableRow key={index}>
                            <TableCell>{file.fileName}</TableCell>
                            <TableCell>
                                <Chip
                                    label={file.mode}
                                    size="small"
                                    color={file.mode === 'edit' ? 'primary' : 'default'}
                                />
                            </TableCell>
                        </TableRow>
                    ))}
                </TableBody>
            </Table>
        </TableContainer>
    );
}

// Main Component
interface SettingsDialogProps {
    open: boolean;
    onClose: () => void;
}

export function SettingsDialog({ open, onClose }: SettingsDialogProps) {
    const dialogRef = useRef<HTMLDivElement>(null);

    // Dragging state
    const [position, setPosition] = useState({ x: 100, y: 50 });
    const [isDragging, setIsDragging] = useState(false);
    const [dragStart, setDragStart] = useState({ x: 0, y: 0 });

    // Config management
    const { config, updateConfig, isSaving } = useSettingsConfig();

    // Provider statuses (to know which providers to show)
    const [providerStatuses, setProviderStatuses] = useState<AIProviderStatuses | null>(null);

    // Accordion expansion state for AI provider sections
    const [expandedSections, setExpandedSections] = useState<{
        xai: boolean;
        claude: boolean;
        openai: boolean;
    }>({
        xai: true,
        claude: true,
        openai: true,
    });

    // Load provider statuses on mount
    useEffect(() => {
        if (open) {
            window.electronAPI.getAIProviderStatuses().then(setProviderStatuses);
        }
    }, [open]);

    // Initialize position when dialog opens
    useEffect(() => {
        if (open && dialogRef.current) {
            const rect = dialogRef.current.getBoundingClientRect();
            const parentRect = dialogRef.current.parentElement?.getBoundingClientRect();
            if (parentRect) {
                setPosition({
                    x: Math.max(0, (parentRect.width - rect.width) / 2),
                    y: Math.max(0, (parentRect.height - rect.height) / 2),
                });
            }
        }
    }, [open]);


    // Dragging handlers
    const handleMouseDown = (e: React.MouseEvent) => {
        if (dialogRef.current) {
            setIsDragging(true);
            setDragStart({
                x: e.clientX - position.x,
                y: e.clientY - position.y
            });
            e.preventDefault();
        }
    };

    useEffect(() => {
        const handleMouseMove = (e: MouseEvent) => {
            if (isDragging && dialogRef.current) {
                const parentRect = dialogRef.current.parentElement?.getBoundingClientRect();
                if (parentRect) {
                    let newX = e.clientX - dragStart.x;
                    let newY = e.clientY - dragStart.y;

                    // Constrain to parent bounds
                    const dialogRect = dialogRef.current.getBoundingClientRect();
                    newX = Math.max(0, Math.min(newX, parentRect.width - dialogRect.width));
                    newY = Math.max(0, Math.min(newY, parentRect.height - dialogRect.height));

                    setPosition({ x: newX, y: newY });
                }
            }
        };

        const handleMouseUp = () => {
            setIsDragging(false);
        };

        if (isDragging) {
            document.addEventListener('mousemove', handleMouseMove);
            document.addEventListener('mouseup', handleMouseUp);
            return () => {
                document.removeEventListener('mousemove', handleMouseMove);
                document.removeEventListener('mouseup', handleMouseUp);
            };
        }
    }, [isDragging, dragStart]);

    // Keyboard handler
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape') {
                onClose();
            }
        };

        if (open) {
            window.addEventListener('keydown', handleKeyDown);
            return () => window.removeEventListener('keydown', handleKeyDown);
        }
    }, [open, onClose]);

    // Handlers for each setting type
    const handleLineEndingChange = (value: 'CRLF' | 'LF') => {
        updateConfig({ defaultLineEnding: value });
    };

    const handleDevToolsToggle = (enabled: boolean) => {
        updateConfig({ devToolsOpen: enabled });
    };

    const handleModelToggle = (provider: 'xai' | 'claude' | 'openai', modelId: string, enabled: boolean) => {
        const newAiModels = {
            ...config?.aiModels,
            [provider]: {
                ...config?.aiModels?.[provider],
                [modelId]: { enabled }
            }
        };
        updateConfig({ aiModels: newAiModels });
    };

    const handleSectionToggle = (provider: 'xai' | 'claude' | 'openai') => {
        setExpandedSections(prev => ({
            ...prev,
            [provider]: !prev[provider]
        }));
    };

    if (!open) return null;

    return (
        <Modal
            open={open}
            onClose={onClose}
            closeAfterTransition
            slots={{ backdrop: Backdrop }}
            slotProps={{
                backdrop: {
                    timeout: 500,
                    sx: { backgroundColor: 'rgba(0, 0, 0, 0.5)' }
                }
            }}
        >
            <DialogContainer
                ref={dialogRef}
                sx={{
                    left: position.x,
                    top: position.y,
                    cursor: isDragging ? 'grabbing' : 'default',
                }}
            >
            <DragHandle onMouseDown={handleMouseDown}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <DragIndicatorIcon fontSize="small" sx={{ color: 'text.secondary' }} />
                    <Typography variant="subtitle2" fontWeight={600}>
                        Settings {isSaving && '(Saving...)'}
                    </Typography>
                </Box>
                <IconButton size="small" onClick={onClose}>
                    <CloseIcon fontSize="small" />
                </IconButton>
            </DragHandle>

            <DialogContent>
                {/* Basic Settings Section */}
                <SectionHeader>Basic Settings</SectionHeader>

                {/* Line Ending Select */}
                <FormControl size="small" fullWidth sx={{ mb: 2 }}>
                    <InputLabel>Default Line Ending</InputLabel>
                    <Select
                        value={config?.defaultLineEnding || 'CRLF'}
                        label="Default Line Ending"
                        onChange={(e) => handleLineEndingChange(e.target.value as 'CRLF' | 'LF')}
                    >
                        <MenuItem value="CRLF">CRLF (Windows)</MenuItem>
                        <MenuItem value="LF">LF (Unix/Mac)</MenuItem>
                    </Select>
                    <FormHelperText>Line ending format for new files</FormHelperText>
                </FormControl>

                {/* DevTools Toggle */}
                <FormControlLabel
                    control={
                        <Switch
                            checked={config?.devToolsOpen || false}
                            onChange={(e) => handleDevToolsToggle(e.target.checked)}
                            size="small"
                        />
                    }
                    label="Developer Tools"
                    sx={{ mb: 2 }}
                />

                {/* AI Models Section */}
                <SectionHeader>AI Models</SectionHeader>

                {/* AI Provider Sections - Render only for enabled providers */}
                {providerStatuses?.xai.enabled && (
                    <AIProviderSection
                        title="xAI (Grok)"
                        provider="xai"
                        config={config}
                        onModelToggle={handleModelToggle}
                        expanded={expandedSections.xai}
                        onToggle={() => handleSectionToggle('xai')}
                    />
                )}

                {providerStatuses?.claude.enabled && (
                    <AIProviderSection
                        title="Anthropic Claude"
                        provider="claude"
                        config={config}
                        onModelToggle={handleModelToggle}
                        expanded={expandedSections.claude}
                        onToggle={() => handleSectionToggle('claude')}
                    />
                )}

                {providerStatuses?.openai.enabled && (
                    <AIProviderSection
                        title="OpenAI"
                        provider="openai"
                        config={config}
                        onModelToggle={handleModelToggle}
                        expanded={expandedSections.openai}
                        onToggle={() => handleSectionToggle('openai')}
                    />
                )}

                {/* Recent Files Table (Readonly) */}
                <SectionHeader>Recent Files</SectionHeader>
                <FilesTable files={config?.recentFiles || []} />

                {/* Open Files Table (Readonly) */}
                <SectionHeader>Open Files</SectionHeader>
                <FilesTable files={config?.openFiles || []} />
            </DialogContent>
        </DialogContainer>
        </Modal>
    );
}
