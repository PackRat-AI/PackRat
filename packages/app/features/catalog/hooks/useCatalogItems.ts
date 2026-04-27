import { CatalogItemsResponseSchema } from '@packrat/api/schemas/catalog';
import { useInfiniteQuery } from '@tanstack/react-query';
import { apiClient } from 'app/lib/api/packrat';

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
}: GetCatalogItemsParams) => {
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
  return CatalogItemsResponseSchema.parse(data);
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
