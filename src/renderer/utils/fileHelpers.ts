import * as path from 'path';

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
