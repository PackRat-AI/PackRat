/**
 * Decodes common HTML entities in a string
 * @param text - The text containing HTML entities
 * @returns The decoded text
 */
export function decodeHtmlEntities(text: string): string {
  if (!text) return text;

  const htmlEntities: Record<string, string> = {
    '&amp;': '&',
    '&lt;': '<',
    '&gt;': '>',
    '&quot;': '"',
    '&#39;': "'",
    '&apos;': "'",
    '&nbsp;': ' ',
  };

  // Match entity names with 2-6 characters to avoid matching arbitrary long sequences
  return text.replace(/&[a-z]{2,6};|&#\d+;|&#x[0-9a-f]+;/gi, (match) => {
    // Handle named entities
    const namedEntity = htmlEntities[match.toLowerCase()];
    if (namedEntity) return namedEntity;

    // Handle decimal numeric entities (e.g., &#39;)
    if (match.startsWith('&#') && !match.toLowerCase().startsWith('&#x')) {
      const code = Number.parseInt(match.slice(2, -1), 10);
      return String.fromCharCode(code);
    }

    // Handle hexadecimal numeric entities (e.g., &#x27;)
    if (match.toLowerCase().startsWith('&#x')) {
      const code = Number.parseInt(match.slice(3, -1), 16);
      return String.fromCharCode(code);
    }

    return match;
  });
}
