import { useInfiniteQuery } from '@tanstack/react-query';
import axiosInstance, { handleApiError } from 'expo-app/lib/api/client';
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
  try {
    const response = await axiosInstance.get('/api/catalog', {
      params: {
        page: pageParam,
        limit,
        q: query,
        category,
        sort,
      },
    });
    return response.data;
  } catch (error) {
    const { message } = handleApiError(error);
    throw new Error(`Failed to fetch catalog items: ${message}`);
  }
};

// Hook
export function useCatalogItemsInfinite({ query, category, limit, sort }: GetCatalogItemsParams) {
  return useInfiniteQuery({
    queryKey: ['catalogItems', query, category, limit, sort],
    queryFn: ({ pageParam }) => {
      const encodedCategory = encodeURIComponent(category ?? '');
      return getCatalogItems({ pageParam, query, category: encodedCategory, limit, sort });
    },
    initialPageParam: 1,
    getNextPageParam: (lastPage) => {
      if (lastPage.page < lastPage.totalPages) {
        return lastPage.page + 1;
      }
      return undefined;
    },
  });
}
