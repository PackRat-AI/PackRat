import { isValid, parse, parseISO } from 'date-fns';

const DATE_ONLY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Parse a date string, handling YYYY-MM-DD strings as local dates
 * instead of UTC (which is the default `new Date('YYYY-MM-DD')` behavior).
 *
 * Returns `null` for missing or invalid input.
 */
export function parseLocalDate(dateString?: string): Date | null {
  if (!dateString || typeof dateString !== 'string') return null;

  if (DATE_ONLY_PATTERN.test(dateString)) {
    const date = parse(dateString, 'yyyy-MM-dd', new Date());
    return isValid(date) ? date : null;
  }

  const date = parseISO(dateString);
  return isValid(date) ? date : null;
}
/**
 * Format a date string for display, returning an em-dash for missing or
 * invalid values. Uses the user's locale via `toLocaleDateString()`.
 */
export function formatLocalDate(dateString?: string): string {
  if (!dateString) return '\u2014';

  const parsed = parseLocalDate(dateString);
  const date = parsed ?? new Date(dateString); // 👈 fallback

  return Number.isNaN(date.getTime()) ? '\u2014' : date.toLocaleDateString();
}
