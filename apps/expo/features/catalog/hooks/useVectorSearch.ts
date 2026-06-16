import { VectorSearchResponseSchema } from '@packrat/schemas/catalog';
import * as Sentry from '@sentry/react-native';
import { useQuery } from '@tanstack/react-query';
import { apiClient } from 'expo-app/lib/api/packrat';
import { useAuthenticatedQueryToolkit } from 'expo-app/lib/hooks/useAuthenticatedQueryToolkit';

export const vectorSearchApi = async ({ query, limit }: { query: string; limit?: number }) => {
  const { data, error } = await apiClient.catalog['vector-search'].get({
    query: {
      q: query,
      // Server has zod defaults for limit/offset; Treaty's inferred query
      // type treats them as required so we forward defaults explicitly.
      limit: limit ?? 10,
      offset: 0,
    },
  });
  if (error) {
    const err = new Error(String(error.value ?? 'Vector search API error'));
    Sentry.captureException(err, {
      tags: { feature: 'catalog', action: 'vectorSearch' },
      extra: { query, limit, apiError: error.value, httpStatus: error.status },
    });
    throw err;
  }
  return VectorSearchResponseSchema.parse(data);
};

export const useVectorSearch = ({ query, limit }: { query: string; limit?: number }) => {
  const { isQueryEnabledWithAccessToken } = useAuthenticatedQueryToolkit();

  return useQuery({
    queryKey: ['vectorSearch', query],
    enabled: isQueryEnabledWithAccessToken && !!query && query.length > 0,
    queryFn: () => vectorSearchApi({ query, limit }),
  });
};
