import { useMutation, useQueryClient } from '@tanstack/react-query';
import axiosInstance from 'expo-app/lib/api/client';
import type { Post } from '../types';

interface CreatePostInput {
  caption?: string;
  images: string[];
}

export const useCreatePost = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: CreatePostInput) => {
      const response = await axiosInstance.post<Post>('/api/feed', input);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['feed'] });
    },
  });
};
