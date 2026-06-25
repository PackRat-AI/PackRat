import { differenceInCalendarDays, format } from 'date-fns';
import type { TranslationFunction } from 'expo-app/lib/i18n/types';
import { parseLocalDate } from 'expo-app/lib/utils/dateUtils';

export function countdownLabel({
  dateString,
  t,
}: {
  dateString: string;
  t: TranslationFunction;
}): string {
  const parsed = parseLocalDate(dateString);
  if (!parsed) return '';
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const days = differenceInCalendarDays(parsed, today);
  if (days === 0) return t('trips.today');
  if (days === 1) return t('trips.tomorrow');
  return t('trips.inDays', { count: days });
}

export function formatDateRange({ start, end }: { start?: string; end?: string }): string {
  if (!start) return '';
  const s = parseLocalDate(start);
  const e = end ? parseLocalDate(end) : null;
  const formatted = s ? format(s, 'MMM d') : '';
  if (!e) return formatted;
  return `${formatted} – ${format(e, 'MMM d, yyyy')}`;
}
