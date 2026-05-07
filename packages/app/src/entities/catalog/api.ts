import type { ApiClient } from '../../shared/api';

export type CatalogSortField =
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

export const getCatalogItems = (client: ApiClient, params: FetchCatalogItemsParams = {}) => {
  const { page = 1, limit = 20, q, category, sort } = params;
  return client.catalog.get({
    query: {
      page,
      limit,
      ...(q ? { q } : {}),
      ...(category ? { category } : {}),
      ...(sort ? { sort } : {}),
    },
  });
};
