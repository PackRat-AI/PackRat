import { useQuery } from '@tanstack/react-query';
import { getCatalogItems } from './useCatalogItems';

/**
 * Fetches the most popular catalog items, sorted by usage count (number of times
 * an item has been added to packs across all users).
 */
export function usePopularCatalogItems(limit = 10) {
  return useQuery({
    queryKey: ['catalogItems', 'popular', limit],
    queryFn: () =>
      getCatalogItems({
        limit,
        sort: { field: 'usage', order: 'desc' },
      }),
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}
