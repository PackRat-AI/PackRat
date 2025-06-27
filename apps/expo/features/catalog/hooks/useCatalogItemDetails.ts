import { useQuery } from '@tanstack/react-query';
import axiosInstance, { handleApiError } from 'expo-app/lib/api/client';
import type { CatalogItem } from '../types';

// API function
export const getCatalogItem = async (id: string): Promise<CatalogItem> => {
  try {
    const response = await axiosInstance.get(`/api/catalog/${id}`);
    return response.data;
  } catch (error) {
    const { message } = handleApiError(error);
    throw new Error(`Failed to fetch catalog item: ${message}`);
  }
};

// Hook
export function useCatalogItemDetails(id: string) {
  return useQuery({
    queryKey: ['catalogItem', id],
    queryFn: () => getCatalogItem(id),
    enabled: !!id,
  });
}
