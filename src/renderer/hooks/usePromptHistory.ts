import { useRef, useCallback } from 'react';

const DEFAULT_MAX_SIZE = 10;

interface UsePromptHistoryReturn {
    /** Add a prompt to the history buffer. Call when a prompt is sent. */
    addToHistory: (prompt: string) => void;
    /** Navigate to an older prompt. Returns the prompt string or undefined if at the oldest. */
    navigateUp: (currentInput: string) => string | undefined;
    /** Navigate to a newer prompt. Returns the prompt string, draft, or undefined if already at newest. */
    navigateDown: () => string | undefined;
    /** Reset navigation index. Call when the user manually edits the input. */
    resetNavigation: () => void;
}

export function usePromptHistory(maxSize: number = DEFAULT_MAX_SIZE): UsePromptHistoryReturn {
    const bufferRef = useRef<string[]>([]);
    const writeIndexRef = useRef(0);
    const countRef = useRef(0);
    const navIndexRef = useRef(-1);
    const draftRef = useRef('');

    const addToHistory = useCallback((prompt: string) => {
        const trimmed = prompt.trim();
        if (!trimmed) return;

        // Deduplicate consecutive entries
        if (countRef.current > 0) {
            const lastIndex = (writeIndexRef.current - 1 + maxSize) % maxSize;
            if (bufferRef.current[lastIndex] === trimmed) {
                navIndexRef.current = -1;
                return;
            }
        }

        bufferRef.current[writeIndexRef.current] = trimmed;
        writeIndexRef.current = (writeIndexRef.current + 1) % maxSize;
        if (countRef.current < maxSize) countRef.current++;
        navIndexRef.current = -1;
    }, [maxSize]);

    const navigateUp = useCallback((currentInput: string): string | undefined => {
        if (countRef.current === 0) return undefined;

        const nextNav = navIndexRef.current + 1;
        if (nextNav >= countRef.current) return undefined;

        // Save draft on first navigation
        if (navIndexRef.current === -1) {
            draftRef.current = currentInput;
        }

        navIndexRef.current = nextNav;
        const bufferIndex = (writeIndexRef.current - 1 - nextNav + countRef.current * maxSize) % maxSize;
        return bufferRef.current[bufferIndex];
    }, [maxSize]);

    const navigateDown = useCallback((): string | undefined => {
        if (navIndexRef.current <= 0) {
            if (navIndexRef.current === 0) {
                navIndexRef.current = -1;
                return draftRef.current;
            }
            return undefined;
        }

        navIndexRef.current--;
        const bufferIndex = (writeIndexRef.current - 1 - navIndexRef.current + countRef.current * maxSize) % maxSize;
        return bufferRef.current[bufferIndex];
    }, [maxSize]);

    const resetNavigation = useCallback(() => {
        navIndexRef.current = -1;
    }, []);

    return { addToHistory, navigateUp, navigateDown, resetNavigation };
}
