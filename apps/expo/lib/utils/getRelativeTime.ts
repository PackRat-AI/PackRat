export function getRelativeTime(dateString: string): string {
  const diff = (Date.now() - new Date(dateString).getTime()) / 1000;
  const units = [
    { label: 'month', seconds: 2592000 },
    { label: 'week', seconds: 604800 },
    { label: 'day', seconds: 86400 },
    { label: 'hour', seconds: 3600 },
    { label: 'minute', seconds: 60 },
  ];

  for (const { label, seconds } of units) {
    const val = Math.floor(diff / seconds);
    if (val >= 1) return `${val} ${label}${val > 1 ? 's' : ''} ago`;
  }

  return 'Just now';
}
