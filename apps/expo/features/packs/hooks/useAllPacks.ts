import { useQuery } from '@tanstack/react-query';
import axiosInstance, { handleApiError } from 'expo-app/lib/api/client';
import { useAuthenticatedQueryToolkit } from 'expo-app/lib/hooks/useAuthenticatedQueryToolkit';
import type { Pack } from '../types';

export const fetchAllPacks = async (): Promise<Pack[]> => {
  try {
    const res = await axiosInstance.get('/api/packs', {
      params: {
        includePublic: 1, // 1 for true, 0 false
      },
    });
    return res.data;
  } catch (error) {
    const { message } = handleApiError(error);
    throw new Error(message);
  }
};

export function useAllPacks(enabled: boolean) {
  const { isQueryEnabledWithAccessToken } = useAuthenticatedQueryToolkit();

  return useQuery({
    queryKey: ['allPacks'],
    enabled: isQueryEnabledWithAccessToken && enabled,
    queryFn: fetchAllPacks,
    staleTime: 1000 * 60 * 5, // 5 min
    refetchOnWindowFocus: false,
  });
}
