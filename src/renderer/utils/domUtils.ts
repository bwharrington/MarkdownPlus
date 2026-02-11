// DOM utility functions for contenteditable and text highlighting

/**
 * Highlight all instances of a word in a DOM element
 */
export function highlightWordInElement(element: HTMLElement, word: string): void {
    const regex = new RegExp(`\\b(${word})\\b`, 'gi');

    // Recursively process text nodes
    const processNode = (node: Node) => {
        if (node.nodeType === Node.TEXT_NODE && node.textContent) {
            const text = node.textContent;
            if (regex.test(text)) {
                // Reset regex index
                regex.lastIndex = 0;

                // Create a span to replace the text node with highlighted content
                const span = document.createElement('span');
                let lastIndex = 0;
                let match;

                while ((match = regex.exec(text)) !== null) {
                    // Add text before match
                    if (match.index > lastIndex) {
                        span.appendChild(document.createTextNode(text.substring(lastIndex, match.index)));
                    }

                    // Add highlighted match
                    const highlight = document.createElement('span');
                    highlight.className = 'word-highlight';
                    highlight.textContent = match[0];
                    span.appendChild(highlight);

                    lastIndex = match.index + match[0].length;
                }

                // Add remaining text
                if (lastIndex < text.length) {
                    span.appendChild(document.createTextNode(text.substring(lastIndex)));
                }

                // Replace the text node with the span containing highlights
                node.parentNode?.replaceChild(span, node);
            }
        } else if (node.nodeType === Node.ELEMENT_NODE) {
            // Skip PRE (code blocks), SCRIPT, and STYLE elements, but allow inline CODE
            const el = node as HTMLElement;
            if (!['PRE', 'SCRIPT', 'STYLE'].includes(el.tagName)) {
                // Process child nodes (create array to avoid live collection issues)
                Array.from(node.childNodes).forEach(processNode);
            }
        }
    };

    // Process all child nodes
    Array.from(element.childNodes).forEach(processNode);
}

/**
 * Extract word at position and find all matches
 */
export function getWordAtPosition(text: string, position: number): { word: string; matches: Array<{ start: number; end: number }> } | null {
    // Find the word boundaries around the clicked position
    let start = position;
    let end = position;

    // Expand left to find word boundary
    while (start > 0 && /[a-zA-Z0-9]/.test(text[start - 1])) {
        start--;
    }

    // Expand right to find word boundary
    while (end < text.length && /[a-zA-Z0-9]/.test(text[end])) {
        end++;
    }

    // Extract the word
    const word = text.substring(start, end);

    // If no valid word found, return null
    if (!word || word.length === 0) {
        return null;
    }

    // Find all matches of this word in the text
    const matches: Array<{ start: number; end: number }> = [];
    const regex = new RegExp(`\\b${word}\\b`, 'g');
    let match;

    while ((match = regex.exec(text)) !== null) {
        matches.push({
            start: match.index,
            end: match.index + word.length,
        });
    }

    return { word, matches };
}

// ContentEditable utility functions

/**
 * Get current cursor position as character offset
 */
export function getCursorPosition(element: HTMLElement): number {
    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0) return 0;

    const range = selection.getRangeAt(0);
    const preRange = range.cloneRange();
    preRange.selectNodeContents(element);
    preRange.setEnd(range.startContainer, range.startOffset);

    return preRange.toString().length;
}

/**
 * Set cursor position by character offset
 */
export function setCursorPosition(element: HTMLElement, offset: number): void {
    const range = document.createRange();
    const selection = window.getSelection();
    if (!selection) return;

    let currentOffset = 0;
    const walker = document.createTreeWalker(
        element,
        NodeFilter.SHOW_TEXT,
        null
    );

    let node;
    while ((node = walker.nextNode())) {
        const nodeLength = node.textContent?.length || 0;
        if (currentOffset + nodeLength >= offset) {
            range.setStart(node, offset - currentOffset);
            range.collapse(true);
            selection.removeAllRanges();
            selection.addRange(range);
            return;
        }
        currentOffset += nodeLength;
    }

    // If offset is beyond content, place cursor at end
    if (element.lastChild) {
        range.selectNodeContents(element);
        range.collapse(false);
        selection.removeAllRanges();
        selection.addRange(range);
    }
}

/**
 * Get plain text content (no HTML tags)
 */
export function getPlainText(element: HTMLElement): string {
    return element.textContent || '';
}

/**
 * Set plain text content (preserve cursor position if possible)
 */
export function setPlainText(element: HTMLElement, text: string, cursorOffset?: number): void {
    const currentOffset = cursorOffset ?? getCursorPosition(element);
    element.textContent = text;
    setCursorPosition(element, Math.min(currentOffset, text.length));
}

/**
 * Clear word highlights from element
 */
export function clearWordHighlights(element: HTMLElement): void {
    element.querySelectorAll('.word-highlight').forEach(el => {
        const parent = el.parentNode;
        if (parent) {
            parent.replaceChild(document.createTextNode(el.textContent || ''), el);
            parent.normalize();
        }
    });
}

/**
 * Clear search-specific highlights (separate from word highlights)
 */
export function clearSearchHighlights(element: HTMLElement): void {
    element.querySelectorAll('.search-highlight, .current-match, .current-line-highlight').forEach(el => {
        const parent = el.parentNode;
        if (parent) {
            parent.replaceChild(document.createTextNode(el.textContent || ''), el);
            parent.normalize();
        }
    });
}

/**
 * Highlight text at specific range with given class
 */
export function highlightTextRange(element: HTMLElement, start: number, end: number, className: string): void {
    const text = element.textContent || '';
    if (start < 0 || end > text.length || start >= end) return;

    // Clear existing search highlights first
    clearSearchHighlights(element);

    // Set the plain text content and then highlight
    element.textContent = text;

    const range = document.createRange();
    const selection = window.getSelection();

    let currentOffset = 0;
    const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT, null);

    let startNode: Node | null = null;
    let startOffset = 0;
    let endNode: Node | null = null;
    let endOffset = 0;

    let node;
    while ((node = walker.nextNode())) {
        const nodeLength = node.textContent?.length || 0;

        // Find start node
        if (!startNode && currentOffset + nodeLength > start) {
            startNode = node;
            startOffset = start - currentOffset;
        }

        // Find end node
        if (currentOffset + nodeLength >= end) {
            endNode = node;
            endOffset = end - currentOffset;
            break;
        }

        currentOffset += nodeLength;
    }

    if (startNode && endNode) {
        range.setStart(startNode, startOffset);
        range.setEnd(endNode, endOffset);

        const highlightSpan = document.createElement('span');
        highlightSpan.className = className;
        range.surroundContents(highlightSpan);

        // Restore selection/cursor
        if (selection) {
            selection.removeAllRanges();
        }
    }
}

/**
 * Escape HTML special characters
 */
export function escapeHtml(text: string): string {
    return text
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}
