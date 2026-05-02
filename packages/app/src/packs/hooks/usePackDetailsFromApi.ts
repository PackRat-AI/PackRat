import { PackWithWeightsSchema } from '@packrat/api/schemas/packs';
import { apiClient } from '@packrat/app/lib/api/packrat';
import { useAuthenticatedQueryToolkit } from '@packrat/app/lib/hooks/useAuthenticatedQueryToolkit';
import { useQuery } from '@tanstack/react-query';

const fetchPackById = async (id: string) => {
  const { data, error } = await apiClient.packs({ packId: id }).get();
  if (error) throw new Error(`Failed to fetch pack: ${error.value}`);
  return PackWithWeightsSchema.parse(data);
};

export function usePackDetailsFromApi({ id, enabled }: { id: string; enabled: boolean }) {
  const { isQueryEnabledWithAccessToken } = useAuthenticatedQueryToolkit();

  const { data, ...rest } = useQuery({
    queryKey: ['pack', id],
    queryFn: () => fetchPackById(id),
    enabled: isQueryEnabledWithAccessToken && !!id && enabled,
  });

  return {
    pack: data,
    ...rest,
  };
}
