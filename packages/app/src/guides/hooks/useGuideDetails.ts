import { apiClient } from '@packrat/app/lib/api/packrat';
import { useQuery } from '@tanstack/react-query';

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
