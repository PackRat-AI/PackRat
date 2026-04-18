import { useMutation, useQueryClient } from '@tanstack/react-query';
import axiosInstance from 'expo-app/lib/api/client';
import type { Comment } from '../types';

interface AddCommentInput {
  postId: number;
  content: string;
  parentCommentId?: number;
}

export const useAddComment = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ postId, content, parentCommentId }: AddCommentInput) => {
      const response = await axiosInstance.post<Comment>(`/api/feed/${postId}/comments`, {
        content,
        parentCommentId,
      });
      return response.data;
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['feed', variables.postId, 'comments'] });
      queryClient.invalidateQueries({ queryKey: ['feed'] });
    },
  });
};
