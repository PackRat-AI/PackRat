import { useQuery } from '@tanstack/react-query';
import { apiClient } from 'app/lib/api/packrat';
import { useAuthenticatedQueryToolkit } from 'app/lib/hooks/useAuthenticatedQueryToolkit';

const getCategories = async (): Promise<string[]> => {
  // Treaty types `limit` as required despite Zod's `.default(10)` — pass it
  // explicitly. Treaty also infers the response as `{}` when the route
  // returns a bare `string[]`, so cast through unknown.
  const { data, error } = await apiClient.catalog.categories.get({ query: { limit: 10 } });
  if (error) throw new Error(`Failed to fetch catalog categories: ${error.value}`);
  return (data as unknown as string[]) ?? [];
};

export function useCatalogItemsCategories() {
  const { isQueryEnabledWithAccessToken } = useAuthenticatedQueryToolkit();

  return useQuery({
    queryKey: ['catalogCategories'],
    queryFn: async () => {
      const cats = await getCategories();
      return ['All', ...cats];
    },
    staleTime: Number.POSITIVE_INFINITY,
    gcTime: Number.POSITIVE_INFINITY,
    enabled: isQueryEnabledWithAccessToken,
  });
}
