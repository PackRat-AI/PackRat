import type { ApiClient } from '../../shared/api';

export async function fetchFeed(client: ApiClient, params: { page?: number; limit?: number } = {}) {
  const { page = 1, limit = 20 } = params;
  const { data, error } = await client.feed.get({ query: { page, limit } });
  if (error) throw new Error('Failed to fetch feed');
  return data;
}
