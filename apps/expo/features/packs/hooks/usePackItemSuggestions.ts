import { useQuery } from '@tanstack/react-query';

import type { CatalogItem } from 'expo-app/features/catalog/types';
import axiosInstance, { handleApiError } from 'expo-app/lib/api/client';
import { useAuthenticatedQueryToolkit } from 'expo-app/lib/hooks/useAuthenticatedQueryToolkit';
import type { Pack } from '../types';

// API function
export const getPackItemSuggestions = async (
  packId: string,
  existingCatalogItemIds: number[],
  location?: string,
): Promise<CatalogItem[]> => {
  try {
    const response = await axiosInstance.post(`/api/packs/${packId}/item-suggestions`, {
      location,
      existingCatalogItemIds,
    });

    return response.data;
  } catch (error) {
    const { message } = handleApiError(error);
    throw new Error(`Failed to fetch pack item suggestions: ${message}`);
  }
};

// Hook
export function usePackItemSuggestions(pack?: Pack, enabled = true, location?: string) {
  const { isQueryEnabledWithAccessToken } = useAuthenticatedQueryToolkit();

  const existingCatalogItemIds = pack?.items
    .filter((item) => item.catalogItemId)
    .map((item) => item.catalogItemId as number) as number[];

  return useQuery({
    queryKey: ['packItemSuggestions', pack?.id],
    queryFn: () => getPackItemSuggestions(pack?.id as string, existingCatalogItemIds, location),
    enabled: isQueryEnabledWithAccessToken && !!pack && enabled,
  });
}
