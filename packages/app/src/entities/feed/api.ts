import type { ApiClient } from '../../shared/api';

// biome-ignore lint/complexity/useMaxParams: requires client + pagination params
export async function fetchFeed(client: ApiClient, page = 1, limit = 20) {
  const { data, error } = await client.feed.get({ query: { page, limit } });
  if (error) throw new Error('Failed to fetch feed');
  return data;
}
