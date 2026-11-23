export interface TripDatesFieldProps {
  /** YYYY-MM-DD, or empty. */
  startDate: string;
  /** YYYY-MM-DD, or empty. */
  endDate: string;
  error?: string;
  onChange: (dates: { startDate: string; endDate: string }) => void;
}

const DAY_FORMAT: Intl.DateTimeFormatOptions = {
  weekday: 'short',
  month: 'short',
  day: 'numeric',
  timeZone: 'UTC',
};

/** "Fri, Dec 4 – Sun, Dec 6", with the year added when it isn't this year. */
export function formatTripRange({
  startDate,
  endDate,
  locale,
}: {
  startDate: string;
  endDate: string;
  locale?: string;
}): string {
  const start = new Date(`${startDate}T00:00:00Z`);
  const end = new Date(`${endDate}T00:00:00Z`);
  const thisYear = new Date().getUTCFullYear();
  const withYear = start.getUTCFullYear() !== thisYear || end.getUTCFullYear() !== thisYear;
  const format = new Intl.DateTimeFormat(locale, {
    ...DAY_FORMAT,
    ...(withYear ? { year: 'numeric' } : {}),
  });
  if (startDate === endDate) return format.format(start);
  return `${format.format(start)} – ${format.format(end)}`;
}

/** Whole days covered by the trip, counting both ends. */
export function tripDayCount({
  startDate,
  endDate,
}: {
  startDate: string;
  endDate: string;
}): number {
  const ms = Date.parse(`${endDate}T00:00:00Z`) - Date.parse(`${startDate}T00:00:00Z`);
  return Math.round(ms / 86_400_000) + 1;
}
