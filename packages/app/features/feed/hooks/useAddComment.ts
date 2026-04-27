import { useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from 'app/lib/api/packrat';

interface AddCommentInput {
  postId: number;
  content: string;
  parentCommentId?: number;
}

export const useAddComment = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ postId, content, parentCommentId }: AddCommentInput) => {
      const { data, error } = await apiClient.feed({ postId: String(postId) }).comments.post({
        content,
        ...(parentCommentId !== undefined ? { parentCommentId } : {}),
      });
      if (error) throw new Error(`Failed to add comment: ${error.value}`);
      return data;
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['feed', variables.postId, 'comments'] });
      queryClient.invalidateQueries({ queryKey: ['feed'] });
    },
  });
};
