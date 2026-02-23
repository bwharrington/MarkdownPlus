import React from 'react';
import {
    Box,
    Select,
    MenuItem,
    FormControl,
    InputLabel,
    Tooltip,
    styled,
} from '@mui/material';
import { WarningAmberIcon } from './AppIcons';
import type { AIProvider, AIModelOption } from '../hooks/useAIChat';
import type { AIChatMode } from '../types/global';
import { isProviderRestrictedFromMode, getRestrictionReason, getRestrictedModesForProvider } from '../aiProviderModeRestrictions';

const SelectorsContainer = styled(Box)(({ theme }) => ({
    display: 'flex',
    gap: 8,
    padding: '8px 12px',
    borderBottom: `1px solid ${theme.palette.divider}`,
}));

const StatusDot = styled('span')<{ status: string }>(({ status }) => ({
    display: 'inline-block',
    width: 8,
    height: 8,
    borderRadius: '50%',
    marginRight: 6,
    backgroundColor: status === 'success' ? '#4caf50'
        : status === 'error' ? '#f44336'
        : status === 'checking' ? '#ff9800'
        : '#9e9e9e',
}));

interface ProviderOption {
    value: AIProvider;
    label: string;
    disabled: boolean;
    status: string;
}

interface ProviderSelectorProps {
    provider: AIProvider;
    providerOptions: ProviderOption[];
    models: AIModelOption[];
    selectedModel: string;
    isLoadingModels: boolean;
    mode: AIChatMode;
    hasDiffTab: boolean;
    hasActiveRequest: boolean;
    onProviderChange: (provider: AIProvider) => void;
    onModelChange: (model: string) => void;
    onModeChange: (mode: AIChatMode) => void;
}

export function ProviderSelector({
    provider,
    providerOptions,
    models,
    selectedModel,
    isLoadingModels,
    mode,
    hasDiffTab,
    hasActiveRequest,
    onProviderChange,
    onModelChange,
    onModeChange,
}: ProviderSelectorProps) {
    return (
        <SelectorsContainer>
            <FormControl size="small" sx={{ minWidth: 140 }}>
                <InputLabel>Provider</InputLabel>
                <Select
                    value={provider}
                    label="Provider"
                    onChange={(e) => onProviderChange(e.target.value as AIProvider)}
                    disabled={hasActiveRequest}
                >
                    {providerOptions.map((opt) => (
                        <MenuItem key={opt.value} value={opt.value}>
                            <StatusDot status={opt.status} />
                            {opt.label}
                        </MenuItem>
                    ))}
                </Select>
            </FormControl>

            <FormControl size="small" sx={{ flex: 1 }}>
                <InputLabel>Model</InputLabel>
                <Select
                    value={selectedModel}
                    label="Model"
                    onChange={(e) => onModelChange(e.target.value)}
                    disabled={isLoadingModels || hasActiveRequest}
                >
                    {models.map((model) => (
                        <MenuItem key={model.id} value={model.id}>
                            {model.displayName}
                        </MenuItem>
                    ))}
                </Select>
            </FormControl>

            <FormControl size="small" sx={{ minWidth: 110 }}>
                <InputLabel>Mode</InputLabel>
                <Select
                    value={mode}
                    label="Mode"
                    onChange={(e) => onModeChange(e.target.value as AIChatMode)}
                    disabled={hasDiffTab || hasActiveRequest}
                >
                    <MenuItem value="chat">Ask</MenuItem>
                    <MenuItem
                        value="edit"
                        disabled={isProviderRestrictedFromMode(provider, 'edit')}
                    >
                        Edit
                    </MenuItem>
                    <MenuItem
                        value="research"
                        disabled={isProviderRestrictedFromMode(provider, 'research')}
                    >
                        Research
                    </MenuItem>
                </Select>
            </FormControl>
            {getRestrictedModesForProvider(provider).includes(mode) && (
                <Tooltip title={getRestrictionReason(provider, mode)}>
                    <WarningAmberIcon fontSize="small" color="warning" sx={{ alignSelf: 'center' }} />
                </Tooltip>
            )}
        </SelectorsContainer>
    );
}
