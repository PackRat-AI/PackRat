/**
 * Relative timestamp for a report, mirroring `TrailConditionReport.timeAgo` in the Swift app
 * (which delegates to `Date.timeAgo`).
 *
 * Uses `Intl.RelativeTimeFormat` so the wording follows the device locale instead of a
 * hand-written English ladder. Hermes ships full ICU, so this is available on Android.
 */

const MINUTE = 60;
const HOUR = MINUTE * 60;
const DAY = HOUR * 24;
const WEEK = DAY * 7;
const MONTH = DAY * 30;
const YEAR = DAY * 365;

const DIVISIONS: ReadonlyArray<{ seconds: number; unit: Intl.RelativeTimeFormatUnit }> =
  Object.freeze([
    { seconds: YEAR, unit: 'year' },
    { seconds: MONTH, unit: 'month' },
    { seconds: WEEK, unit: 'week' },
    { seconds: DAY, unit: 'day' },
    { seconds: HOUR, unit: 'hour' },
    { seconds: MINUTE, unit: 'minute' },
  ]);

export function timeAgo(dateStr?: string | null, now: number = Date.now()): string {
  if (!dateStr) return '';
  const timestamp = new Date(dateStr).getTime();
  if (Number.isNaN(timestamp)) return '';

  // Clamp to the past: a clock skewed slightly ahead of the server should read "just now"
  // rather than "in 3 seconds".
  const elapsedSeconds = Math.max(0, (now - timestamp) / 1000);

  const formatter = new Intl.RelativeTimeFormat(undefined, { numeric: 'auto' });
  for (const { seconds, unit } of DIVISIONS) {
    if (elapsedSeconds >= seconds) {
      return formatter.format(-Math.floor(elapsedSeconds / seconds), unit);
    }
  }
  return formatter.format(0, 'minute');
}
