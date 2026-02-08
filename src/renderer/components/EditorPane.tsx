import React from 'react';
import { useActiveFile } from '../contexts';
import { EditView } from './EditView';
import { PreviewView } from './PreviewView';

export function EditorPane() {
    const activeFile = useActiveFile();

    if (!activeFile) {
        return null;
    }

    if (activeFile.viewMode === 'edit') {
        return <EditView />;
    }

    return <PreviewView />;
}
