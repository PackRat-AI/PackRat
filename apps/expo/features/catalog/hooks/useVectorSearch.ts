import { useQuery } from '@tanstack/react-query';
import axiosInstance from 'expo-app/lib/api/client';
import { useAuthenticatedQueryToolkit } from 'expo-app/lib/hooks/useAuthenticatedQueryToolkit';

const vectorSearchApi = async (query: string, limit?: number) => {
  const response = await axiosInstance.get('/api/catalog/vector-search', {
    params: { q: query, limit },
  });
  return response.data;
};

export const useVectorSearch = ({ query, limit }: { query: string; limit?: number }) => {
  const { isQueryEnabledWithAccessToken } = useAuthenticatedQueryToolkit();

  return useQuery({
    queryKey: ['vectorSearch', query],
    enabled: isQueryEnabledWithAccessToken && !!query && query.length > 0 && !!token,

    queryFn: () => vectorSearchApi(query, limit),
  });
};
