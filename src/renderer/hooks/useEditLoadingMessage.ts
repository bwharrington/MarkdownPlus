import { useState, useEffect, useRef, useCallback } from 'react';

/** All loading messages for the edit loading indicator */
const LOADING_MESSAGES = [
    'Boldly formatting my thoughts...',
    'Italicizing witty replies...',
    'Heading level 1: Thinking deeply...',
    'Bullet-pointing brilliant ideas...',
    'Code-blocking distractions away...',
    'Linking up clever connections...',
    'Strikethrough-ing silly errors...',
    'Indenting for inspiration...',
    'Previewing punny responses...',
    'Rendering ridiculous remarks...',
    'Markdown magic in progress...',
    'Editor elf at work...',
    'Syntax sorcery loading...',
    'Productivity potion brewing...',
    'Whitespace wizardry underway...',
] as const;

/** Interval between new messages in milliseconds */
const MESSAGE_ROTATION_MS = 5000;

/** Delay per character for typewriter effect in milliseconds */
const CHAR_DELAY_MS = 30;

/**
 * Shuffle-bag: returns a random message without repeating until all are used.
 * Mutates the `remaining` array in place and refills from the full pool when empty.
 */
function pickNextMessage(remaining: string[], pool: readonly string[]): string {
    if (remaining.length === 0) {
        remaining.push(...pool);
    }
    const idx = Math.floor(Math.random() * remaining.length);
    return remaining.splice(idx, 1)[0];
}

interface UseEditLoadingMessageResult {
    /** The currently visible (typewriter-animated) text */
    displayText: string;
    /** Whether the typewriter is still revealing characters */
    isTyping: boolean;
}

/**
 * Custom hook that manages a rotating set of loading messages
 * with a typewriter effect. Each message is spelled out character
 * by character, and a new random message is shown every
 * MESSAGE_ROTATION_MS. Messages use a shuffle-bag pattern so
 * no message repeats until all have been used.
 *
 * @param isActive - Whether the loading indicator should be running
 * @param messagePool - Optional custom message pool (defaults to built-in edit messages)
 */
export function useEditLoadingMessage(
    isActive: boolean,
    messagePool?: readonly string[],
): UseEditLoadingMessageResult {
    const pool = messagePool ?? LOADING_MESSAGES;
    const remainingRef = useRef<string[]>([]);
    const [fullMessage, setFullMessage] = useState('');
    const [charIndex, setCharIndex] = useState(0);

    /** Pick the next message from the shuffle bag */
    const rotate = useCallback(() => {
        const next = pickNextMessage(remainingRef.current, pool);
        setFullMessage(next);
        setCharIndex(0);
    }, [pool]);

    // When activated or pool changes, pick the first message immediately
    useEffect(() => {
        if (!isActive) {
            // Reset state when deactivated
            setFullMessage('');
            setCharIndex(0);
            remainingRef.current = [];
            return;
        }
        // Reset bag when pool changes (e.g., phase transition)
        remainingRef.current = [];
        rotate();
    }, [isActive, rotate]);

    // Rotate to a new message every MESSAGE_ROTATION_MS
    useEffect(() => {
        if (!isActive) return;
        const timer = setInterval(rotate, MESSAGE_ROTATION_MS);
        return () => clearInterval(timer);
    }, [isActive, rotate]);

    // Typewriter: advance one character at a time
    useEffect(() => {
        if (!isActive || !fullMessage) return;
        if (charIndex >= fullMessage.length) return;

        const timer = setTimeout(() => {
            setCharIndex(prev => prev + 1);
        }, CHAR_DELAY_MS);

        return () => clearTimeout(timer);
    }, [isActive, fullMessage, charIndex]);

    const displayText = fullMessage.slice(0, charIndex);
    const isTyping = charIndex < fullMessage.length;

    return { displayText, isTyping };
}
