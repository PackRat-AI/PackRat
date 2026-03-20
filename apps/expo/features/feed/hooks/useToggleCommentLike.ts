import { useMutation, useQueryClient } from '@tanstack/react-query';
import axiosInstance from 'expo-app/lib/api/client';
import type { LikeToggleResponse } from '../types';

export const useToggleCommentLike = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ postId, commentId }: { postId: number; commentId: number }) => {
      const response = await axiosInstance.post<LikeToggleResponse>(
        `/api/feed/${postId}/comments/${commentId}/like`,
      );
      return response.data;
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['feed', variables.postId, 'comments'] });
    },
  });
};
