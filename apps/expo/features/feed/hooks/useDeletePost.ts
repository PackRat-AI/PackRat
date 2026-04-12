import { useMutation, useQueryClient } from '@tanstack/react-query';
import axiosInstance from 'expo-app/lib/api/client';

export const useDeletePost = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (postId: number) => {
      await axiosInstance.delete(`/api/feed/${postId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['feed'] });
    },
  });
};
