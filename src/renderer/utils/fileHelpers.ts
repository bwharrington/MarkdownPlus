import * as path from 'path';
import type { FileType } from '../types';

// Supported file extensions
export const MARKDOWN_EXTENSIONS = ['.md', '.markdown', '.mdown', '.mkd', '.mkdn', '.mdx', '.mdwn', '.mdc'];
export const RST_EXTENSIONS = ['.rst', '.rest'];
export const TEXT_EXTENSIONS = ['.txt'];
export const BEST_EFFORT_EXTENSIONS = ['.adoc', '.asciidoc', '.org', '.textile'];

/**
 * Determine the FileType from a file path based on its extension.
 */
export function getFileType(filePath: string): FileType {
    const lowerPath = filePath.toLowerCase();
    if (MARKDOWN_EXTENSIONS.some(ext => lowerPath.endsWith(ext))) return 'markdown';
    if (RST_EXTENSIONS.some(ext => lowerPath.endsWith(ext))) return 'rst';
    if (TEXT_EXTENSIONS.some(ext => lowerPath.endsWith(ext))) return 'text';
    if (BEST_EFFORT_EXTENSIONS.some(ext => lowerPath.endsWith(ext))) return 'text';
    return 'unknown';
}

/**
 * Extract filename from a file path
 */
export function getFileName(filePath: string): string {
    return filePath.split(/[\\/]/).pop() || 'Unknown';
}

/**
 * Get file extension from a file path
 */
export function getFileExtension(filePath: string): string {
    const name = getFileName(filePath);
    const lastDot = name.lastIndexOf('.');
    return lastDot > 0 ? name.substring(lastDot + 1).toLowerCase() : '';
}

/**
 * Check if a file is a markdown file based on extension
 */
export function isMarkdownFile(filePath: string): boolean {
    const ext = getFileExtension(filePath);
    return ['md', 'markdown', 'mdown', 'mkd'].includes(ext);
}

/**
 * Generate a unique ID
 */
export function generateId(): string {
    return Math.random().toString(36).substring(2, 11);
}
