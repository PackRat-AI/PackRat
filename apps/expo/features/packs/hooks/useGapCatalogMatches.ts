import { useQueries } from '@tanstack/react-query';
import { vectorSearchApi } from 'expo-app/features/catalog/hooks/useVectorSearch';
import { useAuthenticatedQueryToolkit } from 'expo-app/lib/hooks/useAuthenticatedQueryToolkit';
import type { GapAnalysisItem } from './usePackGapAnalysis';

export function useGapCatalogMatches(gaps: GapAnalysisItem[]) {
  const { isQueryEnabledWithAccessToken } = useAuthenticatedQueryToolkit();

  return useQueries({
    queries: gaps.map((gap) => ({
      queryKey: ['vectorSearch', gap.suggestion],
      queryFn: () => vectorSearchApi({ query: gap.suggestion, limit: 6 }),
      enabled: isQueryEnabledWithAccessToken && gaps.length > 0,
    })),
  });
}
