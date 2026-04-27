import { useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from 'app/lib/api/packrat';

export const useToggleCommentLike = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ postId, commentId }: { postId: number; commentId: number }) => {
      const { data, error } = await apiClient
        .feed({ postId: String(postId) })
        .comments({ commentId: String(commentId) })
        .like.post();
      if (error) throw new Error(`Failed to toggle comment like: ${error.value}`);
      return data;
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['feed', variables.postId, 'comments'] });
    },
  });
};
