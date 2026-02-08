import { useCallback, useEffect, useState } from 'react';
import { useActiveFile, useEditorDispatch } from '../contexts';
import { getCursorPosition, setCursorPosition, setPlainText, clearSearchHighlights } from '../utils/domUtils';
import type { IFile } from '../types';

export interface FindReplaceState {
    findDialogOpen: boolean;
    searchQuery: string;
    searchMatches: Array<{ start: number; end: number }>;
    currentSearchIndex: number;
    matchCount: number | null;
    replaceQuery: string;
    activeDialogTab: 'find' | 'replace';
}

export interface FindReplaceHandlers {
    setSearchQuery: (query: string) => void;
    setReplaceQuery: (query: string) => void;
    setActiveDialogTab: (tab: 'find' | 'replace') => void;
    handleSearchQueryChange: (query: string) => void;
    handleFindNext: () => void;
    handleCount: () => void;
    handleReplace: () => void;
    handleReplaceAll: () => void;
    handleOpenFind: (tab?: 'find' | 'replace') => void;
    handleCloseFind: () => void;
}

export function useFindReplace(
    contentEditableRef: React.RefObject<HTMLDivElement | null>,
    previewRef: React.RefObject<HTMLDivElement | null>,
): FindReplaceState & FindReplaceHandlers {
    const activeFile = useActiveFile();
    const dispatch = useEditorDispatch();

    // Find dialog state
    const [findDialogOpen, setFindDialogOpen] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [searchMatches, setSearchMatches] = useState<Array<{ start: number; end: number }>>([]);
    const [currentSearchIndex, setCurrentSearchIndex] = useState(-1);
    const [matchCount, setMatchCount] = useState<number | null>(null);

    // Replace state
    const [replaceQuery, setReplaceQuery] = useState('');
    const [activeDialogTab, setActiveDialogTab] = useState<'find' | 'replace'>('find');

    // Find all matches of search query in text (case-insensitive)
    const findAllMatches = useCallback((text: string, query: string): Array<{ start: number; end: number }> => {
        if (!query) return [];

        const matches: Array<{ start: number; end: number }> = [];
        const lowerText = text.toLowerCase();
        const lowerQuery = query.toLowerCase();
        let index = 0;

        while ((index = lowerText.indexOf(lowerQuery, index)) !== -1) {
            matches.push({ start: index, end: index + query.length });
            index += 1;
        }

        return matches;
    }, []);

    // Highlight search match in preview mode
    const highlightSearchInPreview = useCallback((query: string, matchIndex: number) => {
        if (!previewRef.current || !query) return;

        const previewElement = previewRef.current;

        // Clear existing search highlights
        previewElement.querySelectorAll('.search-highlight, .current-match').forEach(el => {
            const parent = el.parentNode;
            if (parent) {
                parent.replaceChild(document.createTextNode(el.textContent || ''), el);
                parent.normalize();
            }
        });

        // Find all text nodes and highlight matches
        let currentMatchCount = 0;
        const regex = new RegExp(`(${query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');

        const highlightInNode = (node: Node) => {
            if (node.nodeType === Node.TEXT_NODE && node.textContent) {
                const text = node.textContent;
                if (regex.test(text)) {
                    regex.lastIndex = 0;
                    const span = document.createElement('span');
                    let lastIndex = 0;
                    let match;

                    while ((match = regex.exec(text)) !== null) {
                        if (match.index > lastIndex) {
                            span.appendChild(document.createTextNode(text.substring(lastIndex, match.index)));
                        }

                        const highlight = document.createElement('span');
                        highlight.className = currentMatchCount === matchIndex ? 'current-match' : 'search-highlight';
                        highlight.textContent = match[0];
                        span.appendChild(highlight);

                        if (currentMatchCount === matchIndex) {
                            requestAnimationFrame(() => {
                                highlight.scrollIntoView({ behavior: 'smooth', block: 'center' });
                            });
                        }

                        currentMatchCount++;
                        lastIndex = match.index + match[0].length;
                    }

                    if (lastIndex < text.length) {
                        span.appendChild(document.createTextNode(text.substring(lastIndex)));
                    }

                    node.parentNode?.replaceChild(span, node);
                }
            } else if (node.nodeType === Node.ELEMENT_NODE) {
                const el = node as HTMLElement;
                if (!['SCRIPT', 'STYLE'].includes(el.tagName)) {
                    Array.from(node.childNodes).forEach(highlightInNode);
                }
            }
        };

        Array.from(previewElement.childNodes).forEach(highlightInNode);
    }, [previewRef]);

    // Highlight search match and line in edit mode
    const highlightSearchMatch = useCallback((matchIndex: number, matches: Array<{ start: number; end: number }>, customText?: string) => {
        if (!contentEditableRef.current || !activeFile || matches.length === 0 || matchIndex < 0) return;

        const element = contentEditableRef.current;
        const text = customText ?? activeFile.content;

        // Clear existing search highlights
        clearSearchHighlights(element);

        // Reset content to plain text
        element.textContent = text;

        if (matchIndex >= matches.length) return;

        const match = matches[matchIndex];

        // Find line boundaries for current match
        const lineStart = text.lastIndexOf('\n', match.start - 1) + 1;
        let lineEnd = text.indexOf('\n', match.start);
        if (lineEnd === -1) lineEnd = text.length;

        const beforeLine = text.substring(0, lineStart);
        const lineContent = text.substring(lineStart, lineEnd);
        const afterLine = text.substring(lineEnd);

        // Calculate match position within the line
        const matchStartInLine = match.start - lineStart;
        const matchEndInLine = match.end - lineStart;

        const beforeMatch = lineContent.substring(0, matchStartInLine);
        const matchText = lineContent.substring(matchStartInLine, matchEndInLine);
        const afterMatch = lineContent.substring(matchEndInLine);

        // Build the DOM
        element.textContent = '';

        if (beforeLine) {
            element.appendChild(document.createTextNode(beforeLine));
        }

        // Create line highlight span
        const lineSpan = document.createElement('span');
        lineSpan.className = 'current-line-highlight';

        if (beforeMatch) {
            lineSpan.appendChild(document.createTextNode(beforeMatch));
        }

        // Create match highlight span
        const matchSpan = document.createElement('span');
        matchSpan.className = 'current-match';
        matchSpan.textContent = matchText;
        lineSpan.appendChild(matchSpan);

        if (afterMatch) {
            lineSpan.appendChild(document.createTextNode(afterMatch));
        }

        element.appendChild(lineSpan);

        if (afterLine) {
            element.appendChild(document.createTextNode(afterLine));
        }

        // Scroll match into view
        requestAnimationFrame(() => {
            matchSpan.scrollIntoView({ behavior: 'smooth', block: 'center' });
        });
    }, [activeFile, contentEditableRef]);

    // Find Next - search from current cursor position (works in both edit and preview modes)
    const handleFindNext = useCallback(() => {
        if (!searchQuery || !activeFile) return;

        const text = activeFile.content;
        const matches = findAllMatches(text, searchQuery);

        if (matches.length === 0) {
            setSearchMatches([]);
            setCurrentSearchIndex(-1);
            setMatchCount(0);
            return;
        }

        setSearchMatches(matches);

        // Calculate next index
        let nextIndex;
        if (currentSearchIndex >= 0 && currentSearchIndex < matches.length) {
            // Move to next match
            nextIndex = (currentSearchIndex + 1) % matches.length;
        } else {
            // Start from beginning or from cursor position in edit mode
            if (activeFile.viewMode === 'edit' && contentEditableRef.current) {
                const cursorPos = getCursorPosition(contentEditableRef.current);
                nextIndex = matches.findIndex(m => m.start >= cursorPos);
                if (nextIndex === -1) {
                    nextIndex = 0; // Wrap to beginning
                }
            } else {
                nextIndex = 0;
            }
        }

        setCurrentSearchIndex(nextIndex);

        // Highlight based on view mode
        if (activeFile.viewMode === 'edit') {
            highlightSearchMatch(nextIndex, matches);
            if (contentEditableRef.current) {
                setCursorPosition(contentEditableRef.current, matches[nextIndex].end);
            }
        } else {
            // Preview mode
            highlightSearchInPreview(searchQuery, nextIndex);
        }
    }, [searchQuery, activeFile, findAllMatches, highlightSearchMatch, highlightSearchInPreview, currentSearchIndex, contentEditableRef]);

    // Count occurrences
    const handleCount = useCallback(() => {
        if (!searchQuery || !activeFile) {
            setMatchCount(0);
            return;
        }

        const matches = findAllMatches(activeFile.content, searchQuery);
        setMatchCount(matches.length);
        setSearchMatches(matches);
    }, [searchQuery, activeFile, findAllMatches]);

    // Replace current match
    const handleReplace = useCallback(() => {
        if (!searchQuery || !activeFile || activeFile.viewMode !== 'edit') return;
        if (!contentEditableRef.current) return;

        const text = activeFile.content;
        let matches = searchMatches;

        // If matches haven't been found yet, find them now
        if (matches.length === 0) {
            matches = findAllMatches(text, searchQuery);
            if (matches.length === 0) {
                setMatchCount(0);
                return;
            }
            setSearchMatches(matches);
            setMatchCount(matches.length);
        }

        // If no current match selected, find the first one from cursor position
        let matchIndex = currentSearchIndex;
        if (matchIndex < 0 || matchIndex >= matches.length) {
            const cursorPos = getCursorPosition(contentEditableRef.current);
            matchIndex = matches.findIndex(m => m.start >= cursorPos);
            if (matchIndex === -1) {
                matchIndex = 0; // Wrap to beginning
            }
            setCurrentSearchIndex(matchIndex);
            highlightSearchMatch(matchIndex, matches);
            return; // Just highlight on first call, replace on next
        }

        const match = matches[matchIndex];

        // Build new content with replacement
        const newContent = text.substring(0, match.start) + replaceQuery + text.substring(match.end);

        // Update content via dispatch
        dispatch({
            type: 'UPDATE_CONTENT',
            payload: { id: activeFile.id, content: newContent },
        });
        dispatch({
            type: 'PUSH_UNDO',
            payload: { id: activeFile.id, content: newContent },
        });

        // Update contenteditable DOM
        const newCursorPos = match.start + replaceQuery.length;
        setPlainText(contentEditableRef.current, newContent, newCursorPos);

        // Recalculate matches with new content
        const newMatches = findAllMatches(newContent, searchQuery);
        setSearchMatches(newMatches);
        setMatchCount(newMatches.length);

        // Find and navigate to next match
        if (newMatches.length > 0) {
            let nextIndex = newMatches.findIndex(m => m.start >= newCursorPos);
            if (nextIndex === -1) {
                nextIndex = 0; // Wrap to beginning
            }
            setCurrentSearchIndex(nextIndex);
            highlightSearchMatch(nextIndex, newMatches, newContent);
            setCursorPosition(contentEditableRef.current, newMatches[nextIndex].end);
        } else {
            setCurrentSearchIndex(-1);
            clearSearchHighlights(contentEditableRef.current);
        }
    }, [searchQuery, replaceQuery, activeFile, currentSearchIndex, searchMatches, dispatch, findAllMatches, highlightSearchMatch, contentEditableRef]);

    // Replace all matches
    const handleReplaceAll = useCallback(() => {
        if (!searchQuery || !activeFile || activeFile.viewMode !== 'edit') return;
        if (!contentEditableRef.current) return;

        const matches = findAllMatches(activeFile.content, searchQuery);
        if (matches.length === 0) return;

        let text = activeFile.content;
        const replacedCount = matches.length;

        // Replace from end to beginning to preserve positions
        const sortedMatches = [...matches].sort((a, b) => b.start - a.start);

        for (const match of sortedMatches) {
            text = text.substring(0, match.start) + replaceQuery + text.substring(match.end);
        }

        // Update content via dispatch
        dispatch({
            type: 'UPDATE_CONTENT',
            payload: { id: activeFile.id, content: text },
        });
        dispatch({
            type: 'PUSH_UNDO',
            payload: { id: activeFile.id, content: text },
        });

        // Update DOM
        contentEditableRef.current.textContent = text;

        // Clear matches and show notification
        setSearchMatches([]);
        setCurrentSearchIndex(-1);
        setMatchCount(0);

        // Show notification
        dispatch({
            type: 'SHOW_NOTIFICATION',
            payload: {
                message: `Replaced ${replacedCount} occurrence${replacedCount !== 1 ? 's' : ''}`,
                severity: 'success',
            },
        });
    }, [searchQuery, replaceQuery, activeFile, dispatch, findAllMatches, contentEditableRef]);

    // Open Find dialog
    const handleOpenFind = useCallback((tab: 'find' | 'replace' = 'find') => {
        setFindDialogOpen(true);
        setActiveDialogTab(tab);
        setMatchCount(null);
    }, []);

    // Close Find dialog
    const handleCloseFind = useCallback(() => {
        setFindDialogOpen(false);
        setSearchQuery('');
        setReplaceQuery('');
        setSearchMatches([]);
        setCurrentSearchIndex(-1);
        setMatchCount(null);
        setActiveDialogTab('find');

        // Clear search highlights based on view mode
        if (activeFile?.viewMode === 'edit' && contentEditableRef.current) {
            contentEditableRef.current.textContent = activeFile.content;
        } else if (activeFile?.viewMode === 'preview' && previewRef.current) {
            // Clear search highlights in preview
            previewRef.current.querySelectorAll('.search-highlight, .current-match').forEach(el => {
                const parent = el.parentNode;
                if (parent) {
                    parent.replaceChild(document.createTextNode(el.textContent || ''), el);
                    parent.normalize();
                }
            });
        }
    }, [activeFile, contentEditableRef, previewRef]);

    // Handle search query change (resets match state)
    const handleSearchQueryChange = useCallback((query: string) => {
        setSearchQuery(query);
        setCurrentSearchIndex(-1);
        setMatchCount(null);
    }, []);

    // Listen for Ctrl+F / Ctrl+H events from App.tsx
    useEffect(() => {
        const handleOpenFindEvent = (e: Event) => {
            if (activeFile) {
                const customEvent = e as CustomEvent<{ tab?: 'find' | 'replace' }>;
                const tab = customEvent.detail?.tab || 'find';
                handleOpenFind(tab);
            }
        };

        window.addEventListener('open-find-dialog', handleOpenFindEvent);
        return () => window.removeEventListener('open-find-dialog', handleOpenFindEvent);
    }, [activeFile, handleOpenFind]);

    return {
        // State
        findDialogOpen,
        searchQuery,
        searchMatches,
        currentSearchIndex,
        matchCount,
        replaceQuery,
        activeDialogTab,
        // Handlers
        setSearchQuery,
        setReplaceQuery,
        setActiveDialogTab,
        handleSearchQueryChange,
        handleFindNext,
        handleCount,
        handleReplace,
        handleReplaceAll,
        handleOpenFind,
        handleCloseFind,
    };
}
