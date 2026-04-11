import { differenceInSeconds, parseISO } from 'date-fns';

const UNITS: Array<{ label: string; seconds: number }> = [
  { label: 'month', seconds: 2592000 },
  { label: 'week', seconds: 604800 },
  { label: 'day', seconds: 86400 },
  { label: 'hour', seconds: 3600 },
  { label: 'minute', seconds: 60 },
];

export function getRelativeTime(dateString: string): string {
  const date = parseISO(dateString);
  const diff = differenceInSeconds(new Date(), date);

  for (const { label, seconds } of UNITS) {
    const val = Math.floor(diff / seconds);
    if (val >= 1) return `${val} ${label}${val > 1 ? 's' : ''} ago`;
  }

  return 'Just now';
}
