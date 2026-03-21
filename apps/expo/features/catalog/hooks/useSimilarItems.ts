import { useQuery } from '@tanstack/react-query';
import axiosInstance, { handleApiError } from 'expo-app/lib/api/client';
import { useAuthenticatedQueryToolkit } from 'expo-app/lib/hooks/useAuthenticatedQueryToolkit';
import type { PackItem } from 'expo-app/types';
import type { CatalogItem } from '../types';

// Types for similar items response
export interface SimilarItem extends Omit<CatalogItem, 'embedding'> {
  similarity: number;
}

export interface SimilarItemsResponse {
  items: SimilarItem[];
  total: number;
  sourceItem: CatalogItem;
}

export interface SimilarItemsParams {
  limit?: number;
  threshold?: number;
}

// API function for catalog item similar items
export const getSimilarCatalogItems = async (
  id: string,
  params?: SimilarItemsParams,
): Promise<SimilarItemsResponse> => {
  try {
    const queryParams = new URLSearchParams();
    if (params?.limit) queryParams.append('limit', params.limit.toString());
    if (params?.threshold) queryParams.append('threshold', params.threshold.toString());

    const url = `/api/catalog/${id}/similar${queryParams.toString() ? `?${queryParams.toString()}` : ''}`;
    const response = await axiosInstance.get(url);
    return response.data;
  } catch (error) {
    const { message } = handleApiError(error);
    throw new Error(`Failed to fetch similar catalog items: ${message}`);
  }
};

// API function for pack item similar items
export const getSimilarPackItems = async (
  packId: string,
  itemId: string,
  params?: SimilarItemsParams,
): Promise<{ items: SimilarItem[]; total: number; sourceItem: PackItem }> => {
  try {
    const queryParams = new URLSearchParams();
    if (params?.limit) queryParams.append('limit', params.limit.toString());
    if (params?.threshold) queryParams.append('threshold', params.threshold.toString());

    const url = `/api/packs/${packId}/items/${itemId}/similar${queryParams.toString() ? `?${queryParams.toString()}` : ''}`;
    const response = await axiosInstance.get(url);
    return response.data;
  } catch (error) {
    const { message } = handleApiError(error);
    throw new Error(`Failed to fetch similar pack items: ${message}`);
  }
};

// Hook for catalog item similar items
export function useSimilarCatalogItems(id: string, params?: SimilarItemsParams) {
  const { isQueryEnabledWithAccessToken } = useAuthenticatedQueryToolkit();

  return useQuery({
    queryKey: ['similarCatalogItems', id, params],
    queryFn: () => getSimilarCatalogItems(id, params),
    enabled: isQueryEnabledWithAccessToken && !!id,
    staleTime: 5 * 60 * 1000, // 5 minutes - similar items don't change often
  });
}

// Hook for pack item similar items
export function useSimilarPackItems(packId: string, itemId: string, params?: SimilarItemsParams) {
  const { isQueryEnabledWithAccessToken } = useAuthenticatedQueryToolkit();

  return useQuery({
    queryKey: ['similarPackItems', packId, itemId, params],
    queryFn: () => getSimilarPackItems(packId, itemId, params),
    enabled: isQueryEnabledWithAccessToken && !!packId && !!itemId,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}
