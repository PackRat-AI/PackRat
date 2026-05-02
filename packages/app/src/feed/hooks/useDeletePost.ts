import { apiClient } from '@packrat/app/lib/api/packrat';
import { useMutation, useQueryClient } from '@tanstack/react-query';

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
