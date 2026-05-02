import { apiClient } from '@packrat/app/lib/api/packrat';
import { useMutation, useQueryClient } from '@tanstack/react-query';

export const useDeleteComment = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ postId, commentId }: { postId: number; commentId: number }) => {
      const { error } = await apiClient
        .feed({ postId: String(postId) })
        .comments({ commentId: String(commentId) })
        .delete();
      if (error) throw new Error(`Failed to delete comment: ${error.value}`);
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['feed', variables.postId, 'comments'] });
      queryClient.invalidateQueries({ queryKey: ['feed'] });
    },
  });
};
