import { useMutation, useQueryClient } from '@tanstack/react-query';
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
      // First, fetch the full pack details with items
      const response = await queryClient.fetchQuery({
        queryKey: ['pack', packId],
        queryFn: async () => {
          const axiosInstance = (await import('expo-app/lib/api/client')).default;
          const res = await axiosInstance.get(`/api/packs/${packId}`);
          return res.data as Pack;
        },
      });

      // Create the new pack from the fetched pack
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
