import { useQuery } from '@tanstack/react-query';
import { apiClient } from 'app/lib/api/packrat';

export const useGuideDetails = (id: string) => {
  return useQuery({
    queryKey: ['guide', id],
    queryFn: async () => {
      const { data, error } = await apiClient.guides({ id }).get();
      if (error) throw new Error(`Failed to fetch guide: ${error.value}`);
      return data;
    },
    enabled: !!id,
  });
};
