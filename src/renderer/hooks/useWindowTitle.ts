import { useEffect } from 'react';
import { useEditorState, useActiveFile } from '../contexts';

export function useWindowTitle() {
    const state = useEditorState();
    const activeFile = useActiveFile();

    useEffect(() => {
        let title = 'Markdown Nexus';

        if (activeFile) {
            const dirtyIndicator = activeFile.isDirty ? '*' : '';
            title = `${dirtyIndicator}${activeFile.name} - Markdown Nexus`;
        }

        window.electronAPI.setWindowTitle(title);
    }, [activeFile?.name, activeFile?.isDirty, state.activeFileId]);
}
