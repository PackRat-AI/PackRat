import { useMutation, useQueryClient } from '@tanstack/react-query';
import axiosInstance from 'expo-app/lib/api/client';

export const useDeleteComment = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ postId, commentId }: { postId: number; commentId: number }) => {
      await axiosInstance.delete(`/api/feed/${postId}/comments/${commentId}`);
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['feed', variables.postId, 'comments'] });
      queryClient.invalidateQueries({ queryKey: ['feed'] });
    },
  });
};
