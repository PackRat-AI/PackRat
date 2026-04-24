import { useInfiniteQuery } from '@tanstack/react-query';
import { rpcClient } from 'expo-app/lib/api/rpcClient';

type SortField = 'name' | 'brand' | 'price' | 'ratingValue' | 'createdAt' | 'updatedAt';

interface GetCatalogItemsParams {
  pageParam?: number;
  query?: string;
  limit: number;
  category?: string;
  sort: { field: SortField; order: 'asc' | 'desc' };
}

// API function
export const getCatalogItems = async ({
  pageParam = 1,
  query,
  category,
  limit,
  sort,
}: GetCatalogItemsParams) => {
  const res = await rpcClient.api.catalog.$get({
    query: {
      page: String(pageParam),
      limit: String(limit),
      q: query,
      category,
      sort,
    },
  });
  if (!res.ok) {
    throw new Error(`Failed to fetch catalog items: ${res.status}`);
  }
  return res.json();
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
