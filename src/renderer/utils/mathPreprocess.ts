/**
 * Normalizes math delimiters to dollar-sign syntax expected by remark-math.
 *
 * remark-math only recognizes $...$ (inline) and $$...$$ (display).
 * AI responses commonly use LaTeX-style \(...\) and \[...\] delimiters.
 * This function converts those to dollar-sign form.
 *
 * IMPORTANT: We must NOT convert:
 * - \left(...\right) or \big(...\big) (LaTeX sizing commands)
 * - Markdown link URLs like [text](url) where url contains underscores
 */
export function preprocessMathDelimiters(content: string): string {
  // 1. Convert LaTeX display math: \[...\] → $$...$$
  //    Handles both single-line and multi-line blocks.
  //    Safe because \[ is not valid markdown syntax.
  let result = content.replace(
    /\\\[([\s\S]*?)\\\]/g,
    (_match, inner: string) => `$$${inner}$$`
  );

  // 2. Convert LaTeX inline math: \(...\) → $...$
  //    Use negative lookbehind to avoid matching \left\( , \big\( , etc.
  //    The pattern requires \( to NOT be preceded by a LaTeX sizing command.
  result = result.replace(
    /(?<!\\(?:left|right|big|Big|bigg|Bigg))\\\(([\s\S]*?)(?<!\\(?:left|right|big|Big|bigg|Bigg))\\\)/g,
    (_match, inner: string) => `$${inner}$`
  );

  return result;
}
