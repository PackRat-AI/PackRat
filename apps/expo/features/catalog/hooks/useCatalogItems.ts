import { useInfiniteQuery } from '@tanstack/react-query';
import { rpcClient } from 'expo-app/lib/api/rpcClient';
import type { PaginatedCatalogItemsResponse } from '../types';

interface GetCatalogItemsParams {
  pageParam?: number;
  query?: string;
  limit: number;
  category?: string;
  sort: { field: string; order: 'asc' | 'desc' };
}

// API function
export const getCatalogItems = async ({
  pageParam = 1,
  query,
  category,
  limit,
  sort,
}: GetCatalogItemsParams): Promise<PaginatedCatalogItemsResponse> => {
  // sort is serialized by the Hono client as sort[field]/sort[order] query params
  const res = await rpcClient.api.catalog.$get({
    query: {
      page: String(pageParam),
      limit: String(limit),
      q: query,
      category,
      sort: sort as never,
    },
  });
  if (!res.ok) {
    throw new Error(`Failed to fetch catalog items: ${res.status}`);
  }
  return res.json() as Promise<PaginatedCatalogItemsResponse>;
};

// Hook
export function useCatalogItemsInfinite({ query, category, limit, sort }: GetCatalogItemsParams) {
  return useInfiniteQuery({
    queryKey: ['catalogItems', query, category, limit, sort],
    queryFn: ({ pageParam }) => getCatalogItems({ pageParam, query, category, limit, sort }),
    initialPageParam: 1,
    getNextPageParam: (lastPage) => {
      if (lastPage.page < lastPage.totalPages) {
        return lastPage.page + 1;
      }
      return undefined;
    },
  });
}
