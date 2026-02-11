import { useCallback, useRef } from 'react';
import { useActiveFile, useEditorDispatch } from '../contexts';
import { getCursorPosition, getPlainText } from '../utils/domUtils';

/**
 * Hook that handles keyboard shortcuts in the editor:
 * - Undo/Redo (Ctrl+Z, Ctrl+Y, Ctrl+Shift+Z)
 * - Bold/Italic (Ctrl+B, Ctrl+I)
 * - Enter key for list continuation (numbered, bulleted, task lists)
 * - Tab key for indentation
 */
export function useEditorKeyboard(
    contentEditableRef: React.RefObject<HTMLDivElement | null>,
    handleUndo: () => void,
    handleRedo: () => void,
    handleMarkdownInsert: (before: string, after: string, placeholder?: string) => void,
) {
    const activeFile = useActiveFile();
    const dispatch = useEditorDispatch();

    // Stable reference to activeFile.id to avoid callback recreation
    const activeFileIdRef = useRef<string | null>(null);
    activeFileIdRef.current = activeFile?.id ?? null;

    const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLDivElement>) => {
        const fileId = activeFileIdRef.current;

        // Handle Ctrl+Z for Undo
        if (e.ctrlKey && e.key === 'z' && !e.shiftKey) {
            e.preventDefault();
            handleUndo();
            return;
        }

        // Handle Ctrl+Y or Ctrl+Shift+Z for Redo
        if ((e.ctrlKey && e.key === 'y') || (e.ctrlKey && e.shiftKey && e.key === 'Z')) {
            e.preventDefault();
            handleRedo();
            return;
        }

        // Handle Ctrl+B for Bold
        if (e.ctrlKey && e.key === 'b') {
            e.preventDefault();
            handleMarkdownInsert('**', '**', 'bold text');
            return;
        }

        // Handle Ctrl+I for Italic
        if (e.ctrlKey && e.key === 'i') {
            e.preventDefault();
            handleMarkdownInsert('*', '*', 'italic text');
            return;
        }

        // Handle Enter key for list continuation
        if (e.key === 'Enter' && !e.ctrlKey && !e.shiftKey && !e.altKey && fileId && contentEditableRef.current) {
            const element = contentEditableRef.current;
            const position = getCursorPosition(element);
            const value = getPlainText(element);

            // Find the start of the current line
            const lineStart = value.lastIndexOf('\n', position - 1) + 1;
            const currentLine = value.substring(lineStart, position);

            // Check for numbered list pattern (e.g., "1. ", "  2. ", "123. ")
            const numberedListMatch = currentLine.match(/^(\s*)(\d+)\.\s(.*)$/);
            if (numberedListMatch) {
                e.preventDefault();
                const [, indent, number] = numberedListMatch;

                // Continue the list with the next number
                const nextNumber = parseInt(number) + 1;
                const insertion = `\n${indent}${nextNumber}. `;

                const selection = window.getSelection();
                if (selection && selection.rangeCount > 0) {
                    const range = selection.getRangeAt(0);
                    range.deleteContents();
                    range.insertNode(document.createTextNode(insertion));
                    range.collapse(false);
                    selection.removeAllRanges();
                    selection.addRange(range);
                }

                const newValue = getPlainText(element);
                dispatch({
                    type: 'UPDATE_CONTENT',
                    payload: { id: fileId, content: newValue },
                });
                return;
            }

            // Check for bulleted list pattern (e.g., "- ", "* ", "+ ", "  - ")
            const bulletedListMatch = currentLine.match(/^(\s*)([-*+])\s(.*)$/);
            if (bulletedListMatch) {
                e.preventDefault();
                const [, indent, bullet] = bulletedListMatch;

                // Continue the list with the same bullet marker
                const insertion = `\n${indent}${bullet} `;

                const selection = window.getSelection();
                if (selection && selection.rangeCount > 0) {
                    const range = selection.getRangeAt(0);
                    range.deleteContents();
                    range.insertNode(document.createTextNode(insertion));
                    range.collapse(false);
                    selection.removeAllRanges();
                    selection.addRange(range);
                }

                const newValue = getPlainText(element);
                dispatch({
                    type: 'UPDATE_CONTENT',
                    payload: { id: fileId, content: newValue },
                });
                return;
            }

            // Check for task list pattern (e.g., "- [ ] ", "- [x] ")
            const taskListMatch = currentLine.match(/^(\s*)([-*+])\s\[([ xX])\]\s(.*)$/);
            if (taskListMatch) {
                e.preventDefault();
                const [, indent, bullet] = taskListMatch;

                // Continue with a new unchecked task
                const insertion = `\n${indent}${bullet} [ ] `;

                const selection = window.getSelection();
                if (selection && selection.rangeCount > 0) {
                    const range = selection.getRangeAt(0);
                    range.deleteContents();
                    range.insertNode(document.createTextNode(insertion));
                    range.collapse(false);
                    selection.removeAllRanges();
                    selection.addRange(range);
                }

                const newValue = getPlainText(element);
                dispatch({
                    type: 'UPDATE_CONTENT',
                    payload: { id: fileId, content: newValue },
                });
                return;
            }
        }

        // Handle Tab key for indentation
        if (e.key === 'Tab' && fileId && contentEditableRef.current) {
            e.preventDefault();

            const selection = window.getSelection();
            if (selection && selection.rangeCount > 0) {
                const range = selection.getRangeAt(0);
                range.deleteContents();
                range.insertNode(document.createTextNode('    '));
                range.collapse(false);
                selection.removeAllRanges();
                selection.addRange(range);

                const newValue = getPlainText(contentEditableRef.current);
                dispatch({
                    type: 'UPDATE_CONTENT',
                    payload: { id: fileId, content: newValue },
                });
            }
        }
    }, [dispatch, handleMarkdownInsert, handleUndo, handleRedo, contentEditableRef]);

    return { handleKeyDown };
}
