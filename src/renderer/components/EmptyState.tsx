import React from 'react';
import { Box, Typography, Button, List, ListItem, ListItemButton, ListItemText, styled } from '@mui/material';
import { NoteAddIcon, FolderOpenIcon, HistoryIcon } from './AppIcons';
import { useFileOperations } from '../hooks';
import { useEditorState } from '../contexts';

const Container = styled(Box)(({ theme }) => ({
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    flex: 1,
    padding: theme.spacing(4),
    backgroundColor: theme.palette.background.default,
}));

const WelcomeCard = styled(Box)(({ theme }) => ({
    textAlign: 'center',
    maxWidth: 500,
    padding: theme.spacing(4),
    backgroundColor: theme.palette.background.paper,
    borderRadius: 16,
    boxShadow: theme.shadows[2],
}));

const ButtonGroup = styled(Box)(({ theme }) => ({
    display: 'flex',
    gap: theme.spacing(2),
    justifyContent: 'center',
    marginTop: theme.spacing(3),
    marginBottom: theme.spacing(3),
}));

const RecentFilesSection = styled(Box)(({ theme }) => ({
    marginTop: theme.spacing(3),
    width: '100%',
    textAlign: 'left',
}));

export function EmptyState() {
    const state = useEditorState();
    const { createNewFile, openFile, openRecentFile, openAllRecentFiles } = useFileOperations();

    const recentFiles = state.config.recentFiles.slice(0, 5);

    return (
        <Container>
            <WelcomeCard>
                <Typography variant="h4" component="h1" gutterBottom>
                    Welcome to Markdown Nexus
                </Typography>
                <Typography variant="body1" color="text.secondary" sx={{ mb: 2 }}>
                    A simple, elegant Markdown editor for creating and editing your documents.
                </Typography>

                <ButtonGroup>
                    <Button
                        variant="contained"
                        startIcon={<NoteAddIcon />}
                        onClick={createNewFile}
                        size="large"
                    >
                        New File
                    </Button>
                    <Button
                        variant="outlined"
                        startIcon={<FolderOpenIcon />}
                        onClick={openFile}
                        size="large"
                    >
                        Open File
                    </Button>
                    {recentFiles.length > 0 && (
                        <Button
                            variant="outlined"
                            startIcon={<HistoryIcon />}
                            onClick={openAllRecentFiles}
                            size="large"
                        >
                            Open All Recent
                        </Button>
                    )}
                </ButtonGroup>

                {recentFiles.length > 0 && (
                    <RecentFilesSection>
                        <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                            Recent Files
                        </Typography>
                        <List dense>
                            {recentFiles.map((fileRef, index) => (
                                <ListItem key={index} disablePadding>
                                    <ListItemButton onClick={() => openRecentFile(fileRef.fileName)}>
                                        <ListItemText
                                            primary={fileRef.fileName.split(/[\\/]/).pop()}
                                            secondary={fileRef.fileName}
                                            primaryTypographyProps={{ noWrap: true }}
                                            secondaryTypographyProps={{ noWrap: true, fontSize: 12 }}
                                        />
                                    </ListItemButton>
                                </ListItem>
                            ))}
                        </List>
                    </RecentFilesSection>
                )}
            </WelcomeCard>
        </Container>
    );
}
