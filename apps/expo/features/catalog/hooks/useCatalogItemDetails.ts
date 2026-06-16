import { CatalogItemSchema } from '@packrat/schemas/catalog';
import * as Sentry from '@sentry/react-native';
import { useQuery } from '@tanstack/react-query';
import { apiClient } from 'expo-app/lib/api/packrat';
import { useAuthenticatedQueryToolkit } from 'expo-app/lib/hooks/useAuthenticatedQueryToolkit';

export const getCatalogItem = async (id: string) => {
  const { data, error } = await apiClient.catalog({ id }).get();
  if (error) {
    const err = new Error(String(error.value ?? 'Failed to fetch catalog item'));
    Sentry.captureException(err, {
      tags: { feature: 'catalog', action: 'getCatalogItem' },
      extra: { id, apiError: error.value, httpStatus: error.status },
    });
    throw err;
  }
  return CatalogItemSchema.parse(data);
};

export function useCatalogItemDetails(id: string) {
  const { isQueryEnabledWithAccessToken } = useAuthenticatedQueryToolkit();

  return useQuery({
    queryKey: ['catalogItem', id],
    queryFn: () => getCatalogItem(id),
    enabled: isQueryEnabledWithAccessToken && !!id,
  });
}
