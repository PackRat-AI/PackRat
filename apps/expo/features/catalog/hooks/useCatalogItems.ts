import { useQuery } from '@tanstack/react-query';
import axiosInstance, { handleApiError } from 'expo-app/lib/api/client';
import type { CatalogItem } from '../types';

// API function
export const getCatalogItems = async (): Promise<CatalogItem[]> => {
  try {
    const response = await axiosInstance.get('/api/catalog');
    return response.data;
  } catch (error) {
    const { message } = handleApiError(error);
    throw new Error(`Failed to fetch catalog items: ${message}`);
  }
};

// Hook
export function useCatalogItems() {
  return useQuery({
    queryKey: ['catalogItems'],
    queryFn: getCatalogItems,
  });
}
