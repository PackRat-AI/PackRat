import { useMutation, useQueryClient } from '@tanstack/react-query';
import axiosInstance, { handleApiError } from 'expo-app/lib/api/client';
import type { TrailCondition } from '../types';

const verifyTrailConditionReport = async (reportId: string): Promise<TrailCondition> => {
  try {
    const res = await axiosInstance.post(`/api/trail-conditions/${reportId}/verify`);
    return res.data;
  } catch (error) {
    const { message } = handleApiError(error);
    console.error('Failed to verify trail condition report:', error);
    throw new Error(message);
  }
};

export function useVerifyTrailConditionReport() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: verifyTrailConditionReport,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['trailConditions'] });
    },
  });
}
