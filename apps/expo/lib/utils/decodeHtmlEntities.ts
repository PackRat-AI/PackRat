import he from 'he';

/**
 * Decodes HTML entities in a string using the `he` library (full HTML5 spec).
 * @param text - The text containing HTML entities
 * @returns The decoded text
 */
export function decodeHtmlEntities(text: string): string {
  if (!text) return text;
  return he.decode(text);
}
