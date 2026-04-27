import { differenceInSeconds } from 'date-fns';

type TFunction = (key: string, options?: Record<string, unknown>) => string;

const UNITS: Array<{ key: string; seconds: number }> = [
  { key: 'months', seconds: 2592000 },
  { key: 'weeks', seconds: 604800 },
  { key: 'days', seconds: 86400 },
  { key: 'hours', seconds: 3600 },
  { key: 'minutes', seconds: 60 },
];

function toDate(value: Date | string | null | undefined): Date | null {
  if (!value) return null;
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

export function getRelativeTime(
  dateValue: Date | string | null | undefined,
  t?: TFunction,
): string {
  const date = toDate(dateValue);
  if (!date) return t ? t('common.timeAgo.justNow') : 'Just now';

  const diff = differenceInSeconds(new Date(), date);

  for (const { key, seconds } of UNITS) {
    const val = Math.floor(diff / seconds);
    if (val >= 1) {
      return t
        ? t(`common.timeAgo.${key}`, { count: val })
        : `${val} ${key.slice(0, -1)}${val > 1 ? 's' : ''} ago`;
    }
  }

  return t ? t('common.timeAgo.justNow') : 'Just now';
}
