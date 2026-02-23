/**
 * Closes any unclosed fenced code blocks in markdown content.
 * Counts opening/closing fence markers (``` on its own line);
 * if the count is odd, a closing fence is appended.
 *
 * This prevents a truncated AI response from breaking the rendering
 * of all content that follows it when documents are concatenated.
 */
export function closeUnclosedFences(content: string): string {
    let open = false;
    const lines = content.split('\n');
    for (const line of lines) {
        if (/^```/.test(line.trimEnd())) {
            open = !open;
        }
    }
    if (open) {
        return content + '\n```\n';
    }
    return content;
}
