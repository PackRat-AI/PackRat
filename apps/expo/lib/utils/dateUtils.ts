/**
 * Parse a date string, handling YYYY-MM-DD strings as local dates
 * instead of UTC (which is the default `new Date('YYYY-MM-DD')` behavior).
 *
 * Returns `null` for missing or invalid input.
 */
export function parseLocalDate(dateString?: string): Date | null {
  if (!dateString) return null;
  const dateOnlyMatch = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateString);
  const date = dateOnlyMatch
    ? new Date(Number(dateOnlyMatch[1]), Number(dateOnlyMatch[2]) - 1, Number(dateOnlyMatch[3]))
    : new Date(dateString);
  return Number.isNaN(date.getTime()) ? null : date;
}

/**
 * Format a date string for display, returning an em-dash for missing or
 * invalid values. Uses the user's locale via `toLocaleDateString()`.
 */
export function formatLocalDate(dateString?: string): string {
  const date = parseLocalDate(dateString);
  return date ? date.toLocaleDateString() : '\u2014';
}
