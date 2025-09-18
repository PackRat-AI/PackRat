import { useMutation } from '@tanstack/react-query';
import axiosInstance, { handleApiError } from 'expo-app/lib/api/client';

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

// API function
export const analyzePackGaps = async (
  packId: string,
  context?: GapAnalysisRequest,
): Promise<GapAnalysisResponse> => {
  try {
    console.log('launching gap analysis with context:', context);
    const response = await axiosInstance.post(`/api/packs/${packId}/gap-analysis`, context || {});
    console.log('Gap Analysis Response:', response.data);
    return response.data;
  } catch (error) {
    const { message } = handleApiError(error);
    console.log('Gap Analysis Error:', JSON.stringify(error));
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
