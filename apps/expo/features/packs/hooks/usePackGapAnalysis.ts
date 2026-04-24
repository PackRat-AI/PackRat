import { useMutation } from '@tanstack/react-query';
import { apiClient } from 'expo-app/lib/api/packrat';

export interface GapAnalysisRequest {
  destination?: string;
  tripType?: string;
  duration?: string;
  startDate?: string;
  endDate?: string;
}

export interface GapAnalysisItem {
  suggestion: string;
  reason: string;
  consumable?: boolean;
  worn?: boolean;
  priority?: 'must-have' | 'nice-to-have' | 'optional';
}

export interface GapAnalysisResponse {
  gaps: GapAnalysisItem[];
  summary?: string;
}

export const analyzePackGaps = async (
  packId: string,
  context?: GapAnalysisRequest,
): Promise<GapAnalysisResponse> => {
  const { data, error } = await apiClient.packs({ packId })['gap-analysis'].post(context ?? {});
  if (error) throw new Error(`Failed to analyze pack gaps: ${error.value}`);
  return data as unknown as GapAnalysisResponse;
};

export function usePackGapAnalysis() {
  return useMutation({
    mutationFn: ({ packId, context }: { packId: string; context?: GapAnalysisRequest }) =>
      analyzePackGaps(packId, context),
  });
}
