import { useMutation } from '@tanstack/react-query';
import axiosInstance, { handleApiError } from 'expo-app/lib/api/client';

export interface GapAnalysisRequest {
  destination?: string;
  tripType?: string;
  duration?: string;
}

export interface GapAnalysisItem {
  suggestion: string;
  reason: string;
  category?: string;
  priority?: 'high' | 'medium' | 'low';
}

export interface GapAnalysisResponse {
  gaps: GapAnalysisItem[];
  summary?: string;
}

// API function
export const analyzePackGaps = async (
  packId: string,
  context?: GapAnalysisRequest,
): Promise<GapAnalysisResponse> => {
  try {
    const response = await axiosInstance.post(`/api/packs/${packId}/gap-analysis`, context || {});
    return response.data;
  } catch (error) {
    const { message } = handleApiError(error);
    throw new Error(`Failed to analyze pack gaps: ${message}`);
  }
};

// Hook
export function usePackGapAnalysis() {
  return useMutation({
    mutationFn: ({ packId, context }: { packId: string; context?: GapAnalysisRequest }) =>
      analyzePackGaps(packId, context),
  });
}
