import { useQuery } from '@tanstack/react-query';
import { PackItem } from '../types';
import { CatalogItem } from 'expo-app/features/catalog/types';
import axiosInstance, { handleApiError } from 'expo-app/lib/api/client';

// API function
export const getPackItemSuggestions = async (
  packId: string,
  packItems: PackItem[],
  location?: string,
): Promise<CatalogItem[]> => {
  try {
    // Extract categories from existing items to help with suggestions
    const categories = Array.from(new Set(packItems.map((item) => item.category).filter(Boolean)));

    const response = await axiosInstance.post(`/api/packs/${packId}/item-suggestions`, {
      packId,
      categories,
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
  packItems: PackItem[] = [],
  enabled = true,
  location?: string,
) {
  return useQuery({
    queryKey: ['packItemSuggestions', packId, packItems.length],
    queryFn: () => getPackItemSuggestions(packId as string, packItems, location),
    enabled: !!packId && enabled,
    staleTime: 1000 * 60 * 5, // 5 minutes
    refetchOnWindowFocus: false,
  });
}
