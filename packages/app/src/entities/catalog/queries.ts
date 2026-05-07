import { useInfiniteQuery } from '@tanstack/react-query';
import { queryKeys, useApiClient } from '../../shared/api';
import { CatalogItemsResponseSchema } from './schema';

export type CatalogSortField =
  | 'name'
  | 'brand'
  | 'category'
  | 'price'
  | 'ratingValue'
  | 'createdAt'
  | 'updatedAt'
  | 'usage';

export interface UseCatalogItemsParams {
  query?: string;
  category?: string;
  limit?: number;
  sort?: { field: CatalogSortField; order: 'asc' | 'desc' };
}

export function useCatalogItemsInfinite({
  query,
  category,
  limit = 20,
  sort,
}: UseCatalogItemsParams) {
  const client = useApiClient();
  return useInfiniteQuery({
    queryKey: queryKeys.catalogInfinite(query, category),
    queryFn: async ({ pageParam = 1 }) => {
      const { data, error } = await client.catalog.get({
        query: {
          page: pageParam as number,
          limit,
          ...(query ? { q: query } : {}),
          ...(category ? { category } : {}),
          ...(sort ? { sort } : {}),
        },
      });
      if (error) throw new Error(`Failed to fetch catalog items: ${String(error)}`);
      const parseResult = CatalogItemsResponseSchema.safeParse(data);
      if (parseResult.success) return parseResult.data;
      return {
        items: (data?.items ?? []) as ReturnType<typeof CatalogItemsResponseSchema.parse>['items'],
        totalCount: Number(data?.totalCount ?? 0),
        page: Number(data?.page ?? 1),
        limit: Number(data?.limit ?? 20),
        totalPages: Number(data?.totalPages ?? 1),
      };
    },
    initialPageParam: 1,
    getNextPageParam: (lastPage) => {
      if (lastPage && lastPage.page < lastPage.totalPages) {
        return lastPage.page + 1;
      }
      return undefined;
    },
  });
}
