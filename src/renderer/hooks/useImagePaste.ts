import { useCallback } from 'react';
import { useActiveFile, useEditorDispatch } from '../contexts';

/**
 * Hook that handles image paste from clipboard and drag-and-drop image insertion.
 *
 * @param insertTextAtCursor - Function from useContentEditable to insert text at cursor position
 */
export function useImagePaste(
    insertTextAtCursor: (text: string) => void,
) {
    const activeFile = useActiveFile();
    const dispatch = useEditorDispatch();

    // Helper to get the document directory from the active file path
    const getDocumentDir = useCallback((): string | null => {
        if (!activeFile?.path) return null;
        // Extract directory from file path (works on both Windows and Unix)
        const lastSep = Math.max(activeFile.path.lastIndexOf('\\'), activeFile.path.lastIndexOf('/'));
        return lastSep >= 0 ? activeFile.path.substring(0, lastSep) : null;
    }, [activeFile?.path]);

    // Helper to save and insert image
    const saveAndInsertImage = useCallback(async (
        imageData: { type: 'clipboard'; base64: string } | { type: 'file'; path: string }
    ) => {
        const documentDir = getDocumentDir();
        if (!documentDir) {
            dispatch({
                type: 'SHOW_NOTIFICATION',
                payload: {
                    message: 'Please save the file first before adding images.',
                    severity: 'warning',
                },
            });
            return;
        }

        const result = imageData.type === 'clipboard'
            ? await window.electronAPI.saveClipboardImage(imageData.base64, documentDir)
            : await window.electronAPI.saveDroppedImage(imageData.path, documentDir);

        if (result.success && result.relativePath) {
            insertTextAtCursor(`![image](${result.relativePath})`);
            dispatch({
                type: 'SHOW_NOTIFICATION',
                payload: {
                    message: `Image saved to ${result.relativePath}`,
                    severity: 'success',
                },
            });
        } else {
            dispatch({
                type: 'SHOW_NOTIFICATION',
                payload: {
                    message: result.error || 'Failed to save image',
                    severity: 'error',
                },
            });
        }
    }, [dispatch, getDocumentDir, insertTextAtCursor]);

    // Handle paste - supports both plain text and clipboard images
    const handlePaste = useCallback((e: React.ClipboardEvent<HTMLDivElement>) => {
        e.preventDefault();

        // Check for image data in clipboard
        const items = e.clipboardData?.items;
        if (items) {
            for (let i = 0; i < items.length; i++) {
                const item = items[i];
                if (item.type.startsWith('image/')) {
                    const blob = item.getAsFile();
                    if (!blob) continue;

                    const reader = new FileReader();
                    reader.onload = () => {
                        const base64Data = (reader.result as string).split(',')[1];
                        if (base64Data) {
                            saveAndInsertImage({ type: 'clipboard', base64: base64Data });
                        }
                    };
                    reader.readAsDataURL(blob);
                    return;
                }
            }
        }

        // No image - insert plain text
        insertTextAtCursor(e.clipboardData.getData('text/plain'));
    }, [insertTextAtCursor, saveAndInsertImage]);

    // Handle drag over to allow image drop
    const handleDragOver = useCallback((e: React.DragEvent<HTMLDivElement>) => {
        if (e.dataTransfer?.types?.includes('Files')) {
            e.preventDefault();
            e.dataTransfer.dropEffect = 'copy';
        }
    }, []);

    // Handle image file drop
    const handleDrop = useCallback((e: React.DragEvent<HTMLDivElement>) => {
        const files = e.dataTransfer?.files;
        if (!files?.length) return;

        const imageTypes = ['image/png', 'image/jpeg', 'image/gif', 'image/bmp', 'image/webp'];
        const imageFiles = Array.from(files).filter(f => imageTypes.includes(f.type));

        if (!imageFiles.length) return;
        e.preventDefault();

        // Process each dropped image
        imageFiles.forEach(async (file) => {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const filePath = (file as any).path;
            if (filePath) {
                await saveAndInsertImage({ type: 'file', path: filePath });
            }
        });
    }, [saveAndInsertImage]);

    return {
        getDocumentDir,
        handlePaste,
        handleDragOver,
        handleDrop,
    };
}
