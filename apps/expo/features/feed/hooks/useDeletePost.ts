import { useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from 'expo-app/lib/api/packrat';

export const useDeletePost = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (postId: number) => {
      const { error } = await apiClient.feed({ postId: String(postId) }).delete();
      if (error) throw new Error(`Failed to delete post: ${error.value}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['feed'] });
    },
  });
};
