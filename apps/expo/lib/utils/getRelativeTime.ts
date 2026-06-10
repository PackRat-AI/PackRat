import { differenceInSeconds } from 'date-fns';
import type { TranslationFunction } from 'expo-app/lib/i18n/types';

const UNITS: Array<{ key: string; seconds: number }> = [
  { key: 'months', seconds: 2592000 },
  { key: 'weeks', seconds: 604800 },
  { key: 'days', seconds: 86400 },
  { key: 'hours', seconds: 3600 },
  { key: 'minutes', seconds: 60 },
] as const;

function toDate(value: Date | string | null | undefined): Date | null {
  if (!value) return null;
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

export function getRelativeTime({
  dateValue,
  t,
}: {
  dateValue: Date | string | null | undefined;
  t?: TranslationFunction;
}): string {
  // i18next resolves pluralization via _one/_other suffixes at runtime.
  // The base keys (e.g. 'common.timeAgo.months') are not in en.json as literals,
  // so a loose cast is needed for dynamic key construction.
  const translate = t as ((key: string, opts?: Record<string, unknown>) => string) | undefined;
  const date = toDate(dateValue);
  if (!date) return translate ? translate('common.timeAgo.justNow') : 'Just now';

  const diff = differenceInSeconds(new Date(), date);

  for (const { key, seconds } of UNITS) {
    const val = Math.floor(diff / seconds);
    if (val >= 1) {
      return translate
        ? translate(`common.timeAgo.${key}`, { count: val })
        : `${val} ${key.slice(0, -1)}${val > 1 ? 's' : ''} ago`;
    }
  }

  return translate ? translate('common.timeAgo.justNow') : 'Just now';
}
