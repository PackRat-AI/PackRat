import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import axiosInstance from 'expo-app/lib/api/client';
import { useAtom } from 'jotai';
import {
  conditionErrorAtom,
  currentTrailConditionAtom,
  isSubmittingConditionAtom,
  trailConditionsAtom,
} from '../atoms/trailConditionsAtoms';
import type { CreateTrailConditionRequest, TrailCondition } from '../types';

const TRAIL_CONDITIONS_QUERY_KEY = 'trail-conditions';

export function useTrailConditions(trailId?: string, trailName?: string) {
  const [, setConditions] = useAtom(trailConditionsAtom);

  return useQuery({
    queryKey: [TRAIL_CONDITIONS_QUERY_KEY, trailId, trailName],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (trailId) params.append('trailId', trailId);
      if (trailName) params.append('trailName', trailName);

      const res = await axiosInstance.get(`/trail-conditions?${params.toString()}`);
      setConditions(res.data.conditions);
      return res.data.conditions as TrailCondition[];
    },
  });
}

export function useTrailCondition(id: string) {
  const [, setCurrent] = useAtom(currentTrailConditionAtom);

  return useQuery({
    queryKey: [TRAIL_CONDITIONS_QUERY_KEY, id],
    queryFn: async () => {
      const res = await axiosInstance.get(`/trail-conditions/${id}`);
      setCurrent(res.data.condition);
      return res.data.condition as TrailCondition;
    },
    enabled: !!id,
  });
}

export function useCreateTrailCondition() {
  const queryClient = useQueryClient();
  const [, setIsSubmitting] = useAtom(isSubmittingConditionAtom);
  const [, setError] = useAtom(conditionErrorAtom);

  return useMutation({
    mutationFn: async (data: CreateTrailConditionRequest) => {
      setIsSubmitting(true);
      setError(null);
      try {
        const res = await axiosInstance.post('/trail-conditions', data);
        return res.data.condition as TrailCondition;
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to submit report';
        setError(message);
        throw err;
      } finally {
        setIsSubmitting(false);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [TRAIL_CONDITIONS_QUERY_KEY] });
    },
  });
}

export function useVerifyTrailCondition() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      id,
      isAccurate,
      notes,
    }: {
      id: string;
      isAccurate: boolean;
      notes?: string;
    }) => {
      await axiosInstance.post(`/trail-conditions/${id}/verify`, { isAccurate, notes });
    },
    onSuccess: (_, { id }) => {
      queryClient.invalidateQueries({ queryKey: [TRAIL_CONDITIONS_QUERY_KEY, id] });
    },
  });
}

export function useDeleteTrailCondition() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      await axiosInstance.delete(`/trail-conditions/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [TRAIL_CONDITIONS_QUERY_KEY] });
    },
  });
}
