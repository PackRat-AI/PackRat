/**
 * Minimal "time ago" formatter — avoids pulling in date-fns just for this.
 */
export function formatDistanceToNow(date: Date): string {
  const now = Date.now();
  const diffMs = now - date.getTime();
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHour = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHour / 24);
  const diffMonth = Math.floor(diffDay / 30);
  const diffYear = Math.floor(diffMonth / 12);

  if (diffYear >= 1) return `${diffYear}y ago`;
  if (diffMonth >= 1) return `${diffMonth}mo ago`;
  if (diffDay >= 1) return `${diffDay}d ago`;
  if (diffHour >= 1) return `${diffHour}h ago`;
  if (diffMin >= 1) return `${diffMin}m ago`;
  return 'just now';
}

export function formatDate(date: Date): string {
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}
