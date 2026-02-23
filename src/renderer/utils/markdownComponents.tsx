import React, { useCallback, useMemo } from 'react';
import { Components } from 'react-markdown';
import { MermaidDiagram } from '../components/MermaidDiagram';
import { CodeBlock } from '../components/CodeBlock';
import { useActiveFile } from '../contexts';

/**
 * Extract text from React children for generating heading IDs
 */
function getTextFromChildren(children: React.ReactNode): string {
    if (typeof children === 'string') return children;
    if (typeof children === 'number') return String(children);
    if (Array.isArray(children)) {
        return children.map(c => getTextFromChildren(c)).join('');
    }
    if (React.isValidElement(children)) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const childProps = children.props as any;
        return getTextFromChildren(childProps.children);
    }
    return '';
}

/**
 * Generate slug ID from text (GitHub-style)
 */
function textToSlug(text: string): string {
    return text
        .toLowerCase()
        .trim()
        .replace(/[^\w\s-]/g, '')
        .replace(/\s+/g, '-')
        .replace(/-+/g, '-');
}

/**
 * Hook that builds the custom ReactMarkdown components configuration.
 * Handles Mermaid diagrams, heading IDs, anchor navigation, and image path resolution.
 *
 * @param previewRef - Ref to the preview container for anchor link scrolling
 */
export function useMarkdownComponents(
    previewRef: React.RefObject<HTMLDivElement | null>,
): Components {
    const activeFile = useActiveFile();

    // Helper to get the document directory from the active file path
    const getDocumentDir = useCallback((): string | null => {
        if (!activeFile?.path) return null;
        const lastSep = Math.max(activeFile.path.lastIndexOf('\\'), activeFile.path.lastIndexOf('/'));
        return lastSep >= 0 ? activeFile.path.substring(0, lastSep) : null;
    }, [activeFile?.path]);

    // Handle anchor link clicks
    const handleAnchorClick = useCallback((e: React.MouseEvent<HTMLAnchorElement>, href: string | undefined) => {
        if (!href) return;

        // Handle internal anchor links
        if (href.startsWith('#')) {
            e.preventDefault();
            const targetId = href.substring(1);
            const targetElement = previewRef.current?.querySelector(`[id="${targetId}"]`);

            if (targetElement && previewRef.current) {
                const elementTop = (targetElement as HTMLElement).offsetTop;
                previewRef.current.scrollTo({
                    top: elementTop - 10,
                    behavior: 'smooth'
                });
            }
        } else if (href.startsWith('http://') || href.startsWith('https://')) {
            // Handle external links - open in default browser
            e.preventDefault();
            window.electronAPI?.openExternal?.(href);
        }
    }, [previewRef]);

    const markdownComponents: Components = useMemo(() => ({
        // Override <pre> to intercept all fenced code blocks (with or without a language tag).
        // ReactMarkdown wraps every fenced block in <pre><code>...</code></pre>, so this is
        // the only reliable place to distinguish fenced blocks from inline `code` spans.
        pre({ children }) {
            // The child is always a <code> element for fenced blocks
            if (React.isValidElement(children) && (children as React.ReactElement<{ className?: string; children?: React.ReactNode }>).props) {
                const codeEl = children as React.ReactElement<{ className?: string; children?: React.ReactNode }>;
                const className = codeEl.props.className || '';
                const match = /language-(\w+)/.exec(className);
                const language = match ? match[1] : '';
                const code = String(codeEl.props.children ?? '').replace(/\n$/, '');

                if (language === 'mermaid') {
                    return <MermaidDiagram chart={code} />;
                }

                if (language) {
                    return <CodeBlock language={language}>{code}</CodeBlock>;
                }
            }

            // Unlabeled fenced blocks — keep the default <pre> wrapper so ASCII diagrams,
            // math notation, and other plain text blocks preserve monospace formatting.
            return <pre>{children}</pre>;
        },
        code({ className, children, ...props }) {
            // Only inline code reaches here now — fenced blocks are handled by pre() above
            return (
                <code className={className} {...props}>
                    {children}
                </code>
            );
        },
        h1({ children, ...props }) {
            const id = textToSlug(getTextFromChildren(children));
            return <h1 id={id} {...props}>{children}</h1>;
        },
        h2({ children, ...props }) {
            const id = textToSlug(getTextFromChildren(children));
            return <h2 id={id} {...props}>{children}</h2>;
        },
        h3({ children, ...props }) {
            const id = textToSlug(getTextFromChildren(children));
            return <h3 id={id} {...props}>{children}</h3>;
        },
        h4({ children, ...props }) {
            const id = textToSlug(getTextFromChildren(children));
            return <h4 id={id} {...props}>{children}</h4>;
        },
        h5({ children, ...props }) {
            const id = textToSlug(getTextFromChildren(children));
            return <h5 id={id} {...props}>{children}</h5>;
        },
        h6({ children, ...props }) {
            const id = textToSlug(getTextFromChildren(children));
            return <h6 id={id} {...props}>{children}</h6>;
        },
        a({ node, href, children, ...props }) {
            return (
                <a
                    href={href}
                    onClick={(e) => handleAnchorClick(e, href)}
                    {...props}
                >
                    {children}
                </a>
            );
        },
        img({ node, src, ...props }) {
            // Convert relative image paths to absolute file:// URLs for local images
            let imageSrc = src;
            if (src && src.startsWith('./') && activeFile?.path) {
                const documentDir = getDocumentDir();
                if (documentDir) {
                    const relativePath = src.substring(2); // Remove './'
                    const absolutePath = `${documentDir}/${relativePath}`.replace(/\\/g, '/');
                    imageSrc = `file:///${absolutePath}`;
                }
            }
            return <img src={imageSrc} {...props} />;
        },
    }), [handleAnchorClick, activeFile?.path, getDocumentDir]);

    return markdownComponents;
}
