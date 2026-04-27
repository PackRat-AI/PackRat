import { useQuery } from '@tanstack/react-query';
import { apiClient } from 'app/lib/api/packrat';
import { useAuthenticatedQueryToolkit } from 'app/lib/hooks/useAuthenticatedQueryToolkit';

const vectorSearchApi = async (query: string, limit?: number) => {
  const { data, error } = await apiClient.catalog['vector-search'].get({
    query: {
      q: query,
      // Server has zod defaults for limit/offset; Treaty's inferred query
      // type treats them as required so we forward defaults explicitly.
      limit: limit ?? 10,
      offset: 0,
    },
  });
  if (error) throw new Error(`Vector search API error: ${error.value}`);
  return data;
};

export const useVectorSearch = ({ query, limit }: { query: string; limit?: number }) => {
  const { isQueryEnabledWithAccessToken } = useAuthenticatedQueryToolkit();

  return useQuery({
    queryKey: ['vectorSearch', query],
    enabled: isQueryEnabledWithAccessToken && !!query && query.length > 0,
    queryFn: () => vectorSearchApi(query, limit),
  });
};
