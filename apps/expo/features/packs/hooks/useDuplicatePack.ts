import { useMutation, useQueryClient } from '@tanstack/react-query';
import { tokenAtom } from 'expo-app/features/auth/atoms/authAtoms';
import { useAtomValue } from 'jotai';
import { useRouter } from 'expo-router';

export function useDuplicatePack() {
  const token = useAtomValue(tokenAtom);
  const queryClient = useQueryClient();
  const router = useRouter();

  return useMutation({
    mutationFn: async ({
      packId,
      name,
    }: {
      packId: string;
      name?: string;
    }): Promise<{
      id: string;
      name: string;
      description: string | null;
      category: string;
      totalWeight: number;
      baseWeight: number;
    }> => {
      const response = await fetch(
        `${process.env.EXPO_PUBLIC_API_URL}/api/packs/${packId}/duplicate`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ name }),
        },
      );

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to duplicate pack');
      }

      return response.json();
    },
    onSuccess: (data) => {
      // Invalidate packs query to refresh the list
      queryClient.invalidateQueries({ queryKey: ['packs'] });
      // Navigate to the new pack
      router.push({ pathname: '/pack/[id]', params: { id: data.id } });
    },
  });
}
