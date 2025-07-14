import { useQuery } from '@tanstack/react-query';

import type { CatalogItem } from 'expo-app/features/catalog/types';
import axiosInstance, { handleApiError } from 'expo-app/lib/api/client';
import { useAuthenticatedQueryToolkit } from 'expo-app/lib/hooks/useAuthenticatedQueryToolkit';

// API function
export const getPackItemSuggestions = async (
  packId: string,
  location?: string,
): Promise<CatalogItem[]> => {
  try {
    const response = await axiosInstance.post(`/api/packs/${packId}/item-suggestions`, {
      location,
    });

    return response.data;
  } catch (error) {
    const { message } = handleApiError(error);
    console.log('suggestions req error', error);
    throw new Error(`Failed to fetch pack item suggestions: ${message}`);
  }
};

// Hook
export function usePackItemSuggestions(
  packId: string | undefined,
  enabled = true,
  location?: string,
) {
  const { isQueryEnabledWithAccessToken } = useAuthenticatedQueryToolkit();

  return useQuery({
    queryKey: ['packItemSuggestions', packId],
    queryFn: () => getPackItemSuggestions(packId as string, location),
    enabled: isQueryEnabledWithAccessToken && !!packId && enabled,
    staleTime: 1000 * 60 * 5, // 5 minutes
    refetchOnWindowFocus: false,
  });
}
