import { CatalogItemSchema, CatalogItemsResponseSchema } from '@packrat/api/schemas/catalog';
import { useInfiniteQuery } from '@tanstack/react-query';
import { apiClient } from 'expo-app/lib/api/packrat';

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
  sort?: { field: CatalogSortField; order: 'asc' | 'desc' };
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
      ...(sort ? { sort } : {}),
    },
  });
  if (error) throw new Error(`Failed to fetch catalog items: ${error.value}`);
  const parseResult = CatalogItemsResponseSchema.safeParse(data);
  if (parseResult.success) return parseResult.data;
  // Filter items individually to salvage valid items when live DB data diverges from schema
  const validItems = (data?.items ?? []).flatMap((item) => {
    const r = CatalogItemSchema.safeParse(item);
    return r.success ? [r.data] : [];
  });
  return {
    items: validItems,
    totalCount: Number(data?.totalCount ?? 0),
    page: Number(data?.page ?? 1),
    limit: Number(data?.limit ?? 20),
    totalPages: Number(data?.totalPages ?? 1),
  };
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
