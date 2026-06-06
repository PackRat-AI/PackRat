import { PackItemSchema } from '@packrat/schemas/packs';
import * as Sentry from '@sentry/react-native';
import { useQuery } from '@tanstack/react-query';
import { apiClient } from 'expo-app/lib/api/packrat';
import { useAuthenticatedQueryToolkit } from 'expo-app/lib/hooks/useAuthenticatedQueryToolkit';
import type { PackItem } from '../types';

export async function fetchPackItemById(id: string) {
  const { data, error } = await apiClient.packs.items({ itemId: id }).get();
  if (error) {
    const err = new Error(String(error.value ?? 'Failed to fetch pack item'));
    Sentry.captureException(err, {
      tags: { feature: 'packs', action: 'fetchPackItemById' },
      extra: { itemId: id, apiError: error.value, httpStatus: error.status },
    });
    throw err;
  }
  // safe-cast: Zod parse validates the shape; TypeScript types diverge from Zod-inferred type
  return PackItemSchema.parse(data) as unknown as PackItem;
}

export function usePackItemDetailsFromApi({ id, enabled }: { id: string; enabled: boolean }) {
  const { isQueryEnabledWithAccessToken } = useAuthenticatedQueryToolkit();

  const { data, ...rest } = useQuery({
    queryKey: ['pack', id],
    queryFn: () => fetchPackItemById(id),
    enabled: isQueryEnabledWithAccessToken && !!id && enabled,
  });

  return {
    item: data,
    ...rest,
  };
}
