import type { ApiClient } from '../../shared/api';
import { PackListResponseSchema, PackSchema } from './schema';

export async function fetchPacks(client: ApiClient) {
  const { data, error } = await client.packs.get({ query: { includePublic: 0 } });
  if (error) throw new Error('Failed to fetch packs');
  return PackListResponseSchema.parse(data);
}

export async function fetchPack(client: ApiClient, packId: string) {
  const { data, error } = await client.packs({ packId }).get();
  if (error) throw new Error('Failed to fetch pack');
  return PackSchema.parse(data);
}
