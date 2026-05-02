import { apiClient } from '@packrat/app/lib/api/packrat';
import { useMutation, useQueryClient } from '@tanstack/react-query';

interface CreatePostInput {
  caption?: string;
  images: string[];
}

export const useCreatePost = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: CreatePostInput) => {
      const { data, error } = await apiClient.feed.post(input);
      if (error) throw new Error(`Failed to create post: ${error.value}`);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['feed'] });
    },
  });
};
