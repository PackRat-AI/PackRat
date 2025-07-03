import { useQuery } from '@tanstack/react-query';

import type { PackItem } from '~/features/packs/types';
import axiosInstance from '~/lib/api/client';
import { useAuthenticatedQueryToolkit } from '~/lib/hooks/useAuthenticatedQueryToolkit';

export async function fetchPackItemById(id: string): Promise<PackItem> {
  const res = await axiosInstance.get(`/api/packs/items/${id}`);
  return res.data;
}

/**
 * Use this to retrieve details of an item not owned by the current user.
 * Since items not owned by the user aren't available in the local store, they must be fetched from the API.
 *
 * @param params - An object containing:
 *  - id: The id of the item to fetch
 *  - enabled: A boolean indicating whether the query should be enabled
 * @returns An object containing:
 *  - item: The fetched item data
 *  - Additional React Query state and helper methods
 */
export function usePackItemDetailsFromApi({ id, enabled }: { id: string; enabled: boolean }) {
  const { isQueryEnabledWithAccessToken } = useAuthenticatedQueryToolkit();

  const { data, ...rest } = useQuery({
    queryKey: ['pack', id],
    queryFn: () => fetchPackItemById(id),
    enabled: isQueryEnabledWithAccessToken && !!id && enabled,
  });

  return {
    item: data,
    ...rest,
  };
}
