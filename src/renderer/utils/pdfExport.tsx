import React from 'react';
import { createRoot } from 'react-dom/client';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import type { Components } from 'react-markdown';
import { MermaidDiagram } from '../components/MermaidDiagram';
import { RstRenderer } from '../components/RstRenderer';

interface BuildPdfHtmlParams {
    fileType: 'markdown' | 'rst' | 'text' | 'unknown';
    content: string;
    documentPath?: string | null;
    title: string;
    existingRenderedElement?: HTMLElement | null;
}

const EXPORT_CSS = `
html, body {
    margin: 0;
    padding: 0;
    background: #ffffff;
    color: #1f2937;
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Oxygen, Ubuntu, Cantarell, "Fira Sans", "Droid Sans", "Helvetica Neue", sans-serif;
    font-size: 14px;
    line-height: 1.5;
}
* {
    box-sizing: border-box;
}
.pdf-export-root {
    padding: 16px;
}
.pdf-export-root h1, .pdf-export-root h2, .pdf-export-root h3, .pdf-export-root h4, .pdf-export-root h5, .pdf-export-root h6 {
    margin-top: 16px;
    margin-bottom: 8px;
    font-weight: 600;
}
.pdf-export-root h1 { font-size: 2em; }
.pdf-export-root h2 { font-size: 1.5em; border-bottom: 1px solid #d0d7de; padding-bottom: 8px; }
.pdf-export-root h3 { font-size: 1.25em; }
.pdf-export-root h4 { font-size: 1.1em; }
.pdf-export-root p { margin-bottom: 16px; }
.pdf-export-root code {
    background-color: #f2f4f8;
    padding: 2px 6px;
    border-radius: 4px;
    font-family: Consolas, Monaco, "Courier New", monospace;
    font-size: 0.9em;
}
.pdf-export-root pre {
    background-color: #f2f4f8;
    padding: 16px;
    border-radius: 8px;
    overflow: auto;
}
.pdf-export-root pre code {
    background-color: transparent;
    padding: 0;
}
.pdf-export-root ul, .pdf-export-root ol {
    padding-left: 24px;
    margin-bottom: 16px;
}
.pdf-export-root li { margin-bottom: 4px; }
.pdf-export-root blockquote {
    border-left: 4px solid #1976d2;
    margin-left: 0;
    padding-left: 16px;
    color: #4b5563;
}
.pdf-export-root a { color: #1976d2; }
.pdf-export-root table {
    border-collapse: collapse;
    width: 100%;
    margin-bottom: 16px;
}
.pdf-export-root th, .pdf-export-root td {
    border: 1px solid #d0d7de;
    padding: 8px;
    text-align: left;
}
.pdf-export-root th { background-color: #f2f4f8; }
.pdf-export-root hr {
    border: none;
    border-top: 1px solid #d0d7de;
    margin: 24px 0;
}
.pdf-export-root img {
    max-width: 100%;
    page-break-inside: avoid;
}
.pdf-export-root .rst-note, .pdf-export-root .rst-warning, .pdf-export-root .rst-tip {
    padding: 12px 16px;
    margin-bottom: 16px;
    border-radius: 4px;
}
.pdf-export-root .rst-note {
    background-color: rgba(33, 150, 243, 0.08);
    border-left: 4px solid #1976d2;
}
.pdf-export-root .rst-warning {
    background-color: rgba(255, 152, 0, 0.08);
    border-left: 4px solid #ed6c02;
}
.pdf-export-root .rst-tip {
    background-color: rgba(76, 175, 80, 0.08);
    border-left: 4px solid #2e7d32;
}
.pdf-export-root dt {
    font-weight: 600;
    margin-top: 8px;
}
.pdf-export-root dd {
    margin-left: 24px;
    margin-bottom: 8px;
}
@page {
    margin: 14mm;
}
`;

function escapeHtml(input: string): string {
    return input
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

function getDocumentDir(documentPath?: string | null): string | null {
    if (!documentPath) return null;
    const lastSep = Math.max(documentPath.lastIndexOf('\\'), documentPath.lastIndexOf('/'));
    return lastSep >= 0 ? documentPath.substring(0, lastSep) : null;
}

function resolveImageSrc(src: string | undefined, documentPath?: string | null): string | undefined {
    if (!src) return src;
    if (src.startsWith('./') && documentPath) {
        const documentDir = getDocumentDir(documentPath);
        if (documentDir) {
            const relativePath = src.substring(2);
            const absolutePath = `${documentDir}/${relativePath}`.replace(/\\/g, '/');
            return `file:///${absolutePath}`;
        }
    }
    return src;
}

function getTextFromChildren(children: React.ReactNode): string {
    if (typeof children === 'string') return children;
    if (typeof children === 'number') return String(children);
    if (Array.isArray(children)) {
        return children.map((c) => getTextFromChildren(c)).join('');
    }
    if (React.isValidElement(children)) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const childProps = children.props as any;
        return getTextFromChildren(childProps.children);
    }
    return '';
}

function textToSlug(text: string): string {
    return text
        .toLowerCase()
        .trim()
        .replace(/[^\w\s-]/g, '')
        .replace(/\s+/g, '-')
        .replace(/-+/g, '-');
}

function createMarkdownComponents(documentPath?: string | null): Components {
    return {
        code({ className, children, ...props }) {
            const match = /language-(\w+)/.exec(className || '');
            const language = match ? match[1] : '';

            if (language === 'mermaid') {
                const chartCode = String(children).replace(/\n$/, '');
                return <MermaidDiagram chart={chartCode} />;
            }

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
        img({ src, ...props }) {
            return <img src={resolveImageSrc(src, documentPath)} {...props} />;
        },
    };
}

function countExpectedMermaidDiagrams(fileType: 'markdown' | 'rst' | 'text' | 'unknown', content: string): number {
    if (fileType === 'markdown') {
        const matches = content.match(/```mermaid[\s\S]*?```/gi);
        return matches ? matches.length : 0;
    }
    if (fileType === 'rst') {
        const matches = content.match(/^\.\.\s+code-block::\s*mermaid\s*$/gim);
        return matches ? matches.length : 0;
    }
    return 0;
}

async function waitForMermaidRender(container: HTMLElement, expectedCount: number): Promise<void> {
    const timeoutMs = 4500;
    const intervalMs = 100;
    const start = Date.now();

    while (Date.now() - start < timeoutMs) {
        const actualCount = container.querySelectorAll('svg[id^="mermaid-diagram-"]').length;
        if (actualCount >= expectedCount) {
            return;
        }
        await new Promise((resolve) => setTimeout(resolve, intervalMs));
    }
}

function ExportPreviewContent({
    fileType,
    content,
    documentPath,
}: {
    fileType: 'markdown' | 'rst' | 'text' | 'unknown';
    content: string;
    documentPath?: string | null;
}) {
    if (fileType === 'rst') {
        return <RstRenderer content={content || ''} documentPath={documentPath} />;
    }

    if (fileType === 'markdown') {
        return (
            <ReactMarkdown
                remarkPlugins={[remarkGfm]}
                components={createMarkdownComponents(documentPath)}
            >
                {content || '*No content*'}
            </ReactMarkdown>
        );
    }

    return <pre>{content}</pre>;
}

function asFullHtmlDocument(title: string, bodyHtml: string): string {
    return `<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8" />
    <title>${escapeHtml(title)}</title>
    <style>${EXPORT_CSS}</style>
</head>
<body>
    <main class="pdf-export-root">${bodyHtml}</main>
</body>
</html>`;
}

export async function buildPdfHtmlDocument({
    fileType,
    content,
    documentPath,
    title,
    existingRenderedElement,
}: BuildPdfHtmlParams): Promise<string> {
    const expectedMermaidCount = countExpectedMermaidDiagrams(fileType, content);

    if (existingRenderedElement) {
        await waitForMermaidRender(existingRenderedElement, expectedMermaidCount);
        return asFullHtmlDocument(title, existingRenderedElement.innerHTML);
    }

    const host = document.createElement('div');
    host.style.position = 'fixed';
    host.style.left = '-100000px';
    host.style.top = '0';
    host.style.width = '1100px';
    host.style.pointerEvents = 'none';
    host.style.background = '#ffffff';
    host.style.color = '#1f2937';
    document.body.appendChild(host);

    const root = createRoot(host);
    root.render(
        <div data-pdf-export-root="true">
            <ExportPreviewContent fileType={fileType} content={content} documentPath={documentPath} />
        </div>
    );

    await new Promise((resolve) => setTimeout(resolve, 80));
    await waitForMermaidRender(host, expectedMermaidCount);

    const exportRoot = host.querySelector('[data-pdf-export-root="true"]') as HTMLElement | null;
    const html = exportRoot ? exportRoot.innerHTML : host.innerHTML;

    root.unmount();
    host.remove();

    return asFullHtmlDocument(title, html);
}
