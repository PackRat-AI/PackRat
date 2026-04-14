import { useQuery } from '@tanstack/react-query';
import { apiClient } from 'expo-app/lib/api/packrat';
import { useAuthenticatedQueryToolkit } from 'expo-app/lib/hooks/useAuthenticatedQueryToolkit';
import type { CatalogItem } from '../types';

export interface SimilarItem extends Omit<CatalogItem, 'embedding'> {
  similarity: number;
}

export interface SimilarItemsParams {
  limit?: number;
  threshold?: number;
}

export interface SimilarItemsResponse {
  items: SimilarItem[];
  total: number;
  sourceItem: CatalogItem;
}

export const getSimilarCatalogItems = async (
  id: string,
  params?: SimilarItemsParams,
): Promise<SimilarItemsResponse> => {
  const { data, error } = await apiClient.catalog({ id }).similar.get({
    query: {
      ...(params?.limit !== undefined ? { limit: String(params.limit) } : {}),
      ...(params?.threshold !== undefined ? { threshold: String(params.threshold) } : {}),
    },
  });
  if (error) throw new Error(`Failed to fetch similar catalog items: ${error.value}`);
  return data as unknown as SimilarItemsResponse;
};

export const getSimilarPackItems = async (
  packId: string,
  opts: { itemId: string; params?: SimilarItemsParams },
) => {
  const { itemId, params } = opts;
  const { data, error } = await apiClient
    .packs({ packId })
    .items({ itemId })
    .similar.get({
      query: {
        ...(params?.limit !== undefined ? { limit: String(params.limit) } : {}),
        ...(params?.threshold !== undefined ? { threshold: String(params.threshold) } : {}),
      },
    });
  if (error) throw new Error(`Failed to fetch similar pack items: ${error.value}`);
  return data;
};

export function useSimilarCatalogItems(id: string, params?: SimilarItemsParams) {
  const { isQueryEnabledWithAccessToken } = useAuthenticatedQueryToolkit();

  return useQuery({
    queryKey: ['similarCatalogItems', id, params],
    queryFn: () => getSimilarCatalogItems(id, params),
    enabled: isQueryEnabledWithAccessToken && !!id,
    staleTime: 5 * 60 * 1000,
  });
}

export function useSimilarPackItems(
  packId: string,
  opts: { itemId: string; params?: SimilarItemsParams },
) {
  const { itemId, params } = opts;
  const { isQueryEnabledWithAccessToken } = useAuthenticatedQueryToolkit();

  return useQuery({
    queryKey: ['similarPackItems', packId, itemId, params],
    queryFn: () => getSimilarPackItems(packId, { itemId, params }),
    enabled: isQueryEnabledWithAccessToken && !!packId && !!itemId,
    staleTime: 5 * 60 * 1000,
  });
}
