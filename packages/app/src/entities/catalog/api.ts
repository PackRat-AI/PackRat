import type { ApiClient } from '../../shared/api';

type CatalogSortField =
  | 'name'
  | 'brand'
  | 'category'
  | 'price'
  | 'ratingValue'
  | 'createdAt'
  | 'updatedAt'
  | 'usage';

export interface FetchCatalogItemsParams {
  page?: number;
  limit?: number;
  q?: string;
  category?: string;
  sort?: { field: CatalogSortField; order: 'asc' | 'desc' };
}

export async function fetchCatalogItems(client: ApiClient, params: FetchCatalogItemsParams = {}) {
  const { page = 1, limit = 20, q, category, sort } = params;
  const { data, error } = await client.catalog.get({
    query: {
      page,
      limit,
      ...(q ? { q } : {}),
      ...(category ? { category } : {}),
      ...(sort ? { sort } : {}),
    },
  });
  if (error) throw new Error('Failed to fetch catalog items');
  return data;
}
