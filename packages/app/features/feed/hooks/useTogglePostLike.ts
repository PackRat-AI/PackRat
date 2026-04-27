import { useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from 'app/lib/api/packrat';

export const useTogglePostLike = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (postId: number) => {
      const { data, error } = await apiClient.feed({ postId: String(postId) }).like.post();
      if (error) throw new Error(`Failed to toggle post like: ${error.value}`);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['feed'] });
    },
  });
};
