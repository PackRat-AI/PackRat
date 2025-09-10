import { useQuery } from '@tanstack/react-query';

import axiosInstance, { handleApiError } from 'expo-app/lib/api/client';
import { useAuthenticatedQueryToolkit } from 'expo-app/lib/hooks/useAuthenticatedQueryToolkit';

export interface EssentialItem {
  name: string;
  category: string;
  priority: 'essential' | 'recommended' | 'optional';
  description?: string;
  alternatives?: string[];
}

export interface GearGapAnalysis {
  activityType: string;
  missingItems: EssentialItem[];
  missingByCategory: Record<string, EssentialItem[]>;
  completionPercentage: number;
  summary: {
    essentialMissing: number;
    recommendedMissing: number;
    optionalMissing: number;
  };
}

export type ActivityType =
  | 'hiking'
  | 'backpacking'
  | 'camping'
  | 'climbing'
  | 'winter'
  | 'desert'
  | 'water sports'
  | 'skiing'
  | 'custom';

// API function
export const getGearGapAnalysis = async (
  packId: string,
  activityType: ActivityType,
): Promise<GearGapAnalysis> => {
  try {
    const response = await axiosInstance.post(`/api/packs/${packId}/gap-analysis`, {
      activityType,
    });

    return response.data;
  } catch (error) {
    const { message } = handleApiError(error);
    throw new Error(`Failed to fetch gear gap analysis: ${message}`);
  }
};

// Hook
export function useGearGapAnalysis(packId: string, activityType: ActivityType, enabled = true) {
  const { isQueryEnabledWithAccessToken } = useAuthenticatedQueryToolkit();

  return useQuery({
    queryKey: ['gearGapAnalysis', packId, activityType],
    queryFn: () => getGearGapAnalysis(packId, activityType),
    enabled: isQueryEnabledWithAccessToken && !!packId && !!activityType && enabled,
  });
}
