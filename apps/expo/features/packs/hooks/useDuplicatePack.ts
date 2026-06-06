import * as Sentry from '@sentry/react-native';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from 'expo-app/lib/api/packrat';
import { useCallback } from 'react';
import type { Pack, PackInput } from '../types';
import { useCreatePackFromPack } from './useCreatePackFromPack';

export function useDuplicatePack() {
  const createPackFromPack = useCreatePackFromPack();
  const queryClient = useQueryClient();

  const duplicatePackMutation = useMutation({
    mutationFn: async ({
      packId,
      packData = {},
    }: {
      packId: string;
      packData?: Partial<PackInput>;
    }) => {
      const response = await queryClient.fetchQuery({
        queryKey: ['pack', packId],
        queryFn: async () => {
          const { data, error } = await apiClient.packs({ packId }).get();
          if (error) {
            const err = new Error(String(error.value ?? 'Failed to fetch pack'));
            Sentry.captureException(err, {
              tags: { feature: 'packs', action: 'duplicatePack.fetchPack' },
              extra: { packId, apiError: error.value, httpStatus: error.status },
            });
            throw err;
          }
          // safe-cast: treaty response shape matches Pack as validated by the API schema
          return data as unknown as Pack;
        },
      });

      const newPackId = createPackFromPack(response, packData);
      return newPackId;
    },
    onError: (error) => {
      console.error('Error duplicating pack:', error);
    },
  });

  const duplicatePack = useCallback(
    (packId: string, packData?: Partial<PackInput>) => {
      return duplicatePackMutation.mutateAsync({ packId, packData });
    },
    [duplicatePackMutation],
  );

  return {
    duplicatePack,
    isLoading: duplicatePackMutation.isPending,
    error: duplicatePackMutation.error,
  };
}
