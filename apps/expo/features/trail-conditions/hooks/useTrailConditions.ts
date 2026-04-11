import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from 'app/lib/api';
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

      const response = await api.get(`/trail-conditions?${params.toString()}`);
      setConditions(response.conditions);
      return response.conditions as TrailCondition[];
    },
  });
}

export function useTrailCondition(id: string) {
  const [, setCurrent] = useAtom(currentTrailConditionAtom);

  return useQuery({
    queryKey: [TRAIL_CONDITIONS_QUERY_KEY, id],
    queryFn: async () => {
      const response = await api.get(`/trail-conditions/${id}`);
      setCurrent(response.condition);
      return response.condition as TrailCondition;
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
        const response = await api.post('/trail-conditions', data);
        return response.condition as TrailCondition;
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
      await api.post(`/trail-conditions/${id}/verify`, { isAccurate, notes });
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
      await api.delete(`/trail-conditions/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [TRAIL_CONDITIONS_QUERY_KEY] });
    },
  });
}
