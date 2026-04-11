import { useMutation, useQueryClient } from '@tanstack/react-query';
import axiosInstance from 'expo-app/lib/api/client';
import type { LikeToggleResponse } from '../types';

export const useTogglePostLike = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (postId: number) => {
      const response = await axiosInstance.post<LikeToggleResponse>(`/api/feed/${postId}/like`);
      return response.data;
    },
    onSuccess: (_data, postId) => {
      queryClient.invalidateQueries({ queryKey: ['feed'] });
      queryClient.invalidateQueries({ queryKey: ['feed', postId] });
    },
  });
};
