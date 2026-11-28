// ── Formatting regex constants ──
const BULLET_LINE_PATTERN = /^\s*[-*]\s+(.+)$/gm;
// A digit before the period is a numbered-list marker ("1. Save"), not the end of a sentence.
const SENTENCE_BOUNDARY_PATTERN = /(\D[.?!])\s*(?=[A-Z])/g;
const CODE_FENCE_PATTERN = /(```[\s\S]*?```)/;
const BOLD_MARKDOWN_PATTERN = /\*\*(.+?)\*\*/g;
const ITALIC_MARKDOWN_PATTERN = /\*(.+?)\*/g;
const MARKDOWN_HEADER_PATTERN = /^#+\s+(.+)$/gm;

/**
 * Formats AI responses to improve readability in the chat UI
 * - Converts markdown lists to plain text with proper spacing
 * - Adds line breaks for better readability
 * - Handles emphasis and other formatting
 */
export function formatAIResponse(text: string): string {
  // Fenced code is left exactly as written: stripping `#` or `*` would change the code itself.
  return text
    .split(CODE_FENCE_PATTERN)
    .map((part) => (part.startsWith('```') ? part : formatProse(part)))
    .join('')
    .trim();
}

function formatProse(text: string): string {
  // Convert markdown lists to plain text with emoji bullets
  let formatted = text.replace(BULLET_LINE_PATTERN, '• $1');

  // Add proper spacing after periods, question marks, and exclamation points
  formatted = formatted.replace(SENTENCE_BOUNDARY_PATTERN, '$1\n\n');

  // Convert markdown emphasis to plain text
  formatted = formatted.replace(BOLD_MARKDOWN_PATTERN, '$1');
  formatted = formatted.replace(ITALIC_MARKDOWN_PATTERN, '$1');

  // Handle markdown headers
  formatted = formatted.replace(MARKDOWN_HEADER_PATTERN, '$1');

  return formatted;
}
