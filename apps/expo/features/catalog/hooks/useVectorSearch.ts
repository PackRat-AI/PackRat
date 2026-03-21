import { useQuery } from '@tanstack/react-query';
import axiosInstance, { handleApiError } from 'expo-app/lib/api/client';
import { useAuthenticatedQueryToolkit } from 'expo-app/lib/hooks/useAuthenticatedQueryToolkit';

const vectorSearchApi = async (query: string, limit?: number) => {
  try {
    const response = await axiosInstance.get('/api/catalog/vector-search', {
      params: { q: query, limit },
    });
    return response.data;
  } catch (error) {
    console.error('Vector search API error:', error);
    const { message } = handleApiError(error);
    throw new Error(`Vector search API error: ${message}`);
  }
};

export const useVectorSearch = ({ query, limit }: { query: string; limit?: number }) => {
  const { isQueryEnabledWithAccessToken } = useAuthenticatedQueryToolkit();

  return useQuery({
    queryKey: ['vectorSearch', query],
    enabled: isQueryEnabledWithAccessToken && !!query && query.length > 0,

    queryFn: () => vectorSearchApi(query, limit),
  });
};
