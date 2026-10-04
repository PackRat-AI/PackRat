export function formatGrams(grams: number): string {
  if (grams >= 1000) return `${(grams / 1000).toFixed(2)} kg`;
  return `${Math.round(grams)} g`;
}

export const TEMPLATE_CATEGORIES = Object.freeze([
  'hiking',
  'backpacking',
  'camping',
  'climbing',
  'winter',
  'desert',
  'water sports',
  'skiing',
  'custom',
] as const);

export function sourceLabel(source: string | null): string {
  if (source === 'tiktok') return 'TikTok';
  if (source === 'youtube') return 'YouTube';
  return 'Manual';
}

export function sourceUrl({
  source,
  contentId,
}: {
  source: string | null;
  contentId: string | null;
}): string | null {
  if (!contentId) return null;
  if (source === 'youtube') return `https://www.youtube.com/watch?v=${contentId}`;
  // TikTok ids come from the post; the URL-hash fallback (`url_…`) can't be linked.
  if (source === 'tiktok' && !contentId.startsWith('url_')) {
    return `https://www.tiktok.com/@/video/${contentId}`;
  }
  return null;
}
