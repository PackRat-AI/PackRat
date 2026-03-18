import { useMutation, useQueryClient } from '@tanstack/react-query';
import axiosInstance, { handleApiError } from 'expo-app/lib/api/client';
import type { TrailCondition, TrailConditionInput } from '../types';

const createTrailConditionReport = async (input: TrailConditionInput): Promise<TrailCondition> => {
  try {
    const res = await axiosInstance.post('/api/trail-conditions', input);
    return res.data;
  } catch (error) {
    const { message } = handleApiError(error);
    console.error('Failed to create trail condition report:', error);
    throw new Error(message);
  }
};

export function useCreateTrailConditionReport() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: createTrailConditionReport,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['trailConditions'] });
    },
  });
}
