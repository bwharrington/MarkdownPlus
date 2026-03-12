import React from 'react';
import { useActiveFile } from '../contexts';
import { EditView } from './EditView';
import { PreviewView } from './PreviewView';
import { DiffView } from './DiffView';

export function EditorPane() {
    const activeFile = useActiveFile();

    if (!activeFile) {
        return null;
    }

    if (activeFile.viewMode === 'diff' && activeFile.diffSession) {
        return <DiffView key={activeFile.id} file={activeFile} />;
    }

    if (activeFile.viewMode === 'edit') {
        return <EditView key={activeFile.id} />;
    }

    return <PreviewView key={activeFile.id} />;
}
