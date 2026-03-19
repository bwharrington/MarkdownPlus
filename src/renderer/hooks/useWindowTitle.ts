import { useEffect } from 'react';
import { useEditorState, useActiveFile } from '../contexts';

export function useWindowTitle() {
    const state = useEditorState();
    const activeFile = useActiveFile();

    useEffect(() => {
        let title = 'Nexus';

        if (activeFile) {
            const dirtyIndicator = activeFile.isDirty ? '*' : '';
            title = `${dirtyIndicator}${activeFile.name} - Nexus`;
        }

        window.electronAPI.setWindowTitle(title);
    }, [activeFile?.name, activeFile?.isDirty, state.activeFileId]);
}
