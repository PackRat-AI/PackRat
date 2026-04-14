import { useInfiniteQuery } from '@tanstack/react-query';
import { apiClient } from 'expo-app/lib/api/packrat';
import type { PaginatedCatalogItemsResponse } from '../types';

type CatalogSortField =
  | 'name'
  | 'brand'
  | 'category'
  | 'price'
  | 'ratingValue'
  | 'createdAt'
  | 'updatedAt'
  | 'usage';

interface GetCatalogItemsParams {
  pageParam?: number;
  query?: string;
  limit: number;
  category?: string;
  sort: { field: CatalogSortField; order: 'asc' | 'desc' };
}

export const getCatalogItems = async ({
  pageParam = 1,
  query,
  category,
  limit,
  sort,
}: GetCatalogItemsParams): Promise<PaginatedCatalogItemsResponse> => {
  const { data, error } = await apiClient.catalog.get({
    query: {
      page: pageParam,
      limit,
      ...(query ? { q: query } : {}),
      ...(category ? { category } : {}),
      sort,
    },
  });
  if (error) throw new Error(`Failed to fetch catalog items: ${error.value}`);
  // Treaty infers the wider Drizzle row shape; consumers expect the local
  // `CatalogItem` projection. Bridge with an explicit assertion.
  return data as unknown as PaginatedCatalogItemsResponse;
};

export function useCatalogItemsInfinite({ query, category, limit, sort }: GetCatalogItemsParams) {
  return useInfiniteQuery({
    queryKey: ['catalogItems', query, category, limit, sort],
    queryFn: ({ pageParam }) => getCatalogItems({ pageParam, query, category, limit, sort }),
    initialPageParam: 1,
    getNextPageParam: (lastPage) => {
      if (lastPage && lastPage.page < lastPage.totalPages) {
        return lastPage.page + 1;
      }
      return undefined;
    },
  });
}
