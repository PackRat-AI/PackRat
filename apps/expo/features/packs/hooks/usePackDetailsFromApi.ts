import { useQuery } from "@tanstack/react-query";
import axiosInstance from "expo-app/lib/api/client";
import { useAuthenticatedQueryToolkit } from "expo-app/lib/hooks/useAuthenticatedQueryToolkit";
import type { Pack } from "../types";

const fetchPackById = async (id: string): Promise<Pack> => {
  const res = await axiosInstance.get(`/api/packs/${id}`);
  return res.data;
};

/**
 * Use this to retrieve details of a pack not owned by the current user.
 * Since packs not owned by the user aren't available in the local store, they must be fetched from the API.
 *
 * @param params - An object containing:
 *  - id: The id of the pack to fetch
 *  - enabled: A boolean indicating whether the query should be enabled
 * @returns An object containing:
 *  - pack: The fetched pack data
 *  - Additional React Query state and helper methods
 */
export function usePackDetailsFromApi({
  id,
  enabled,
}: {
  id: string;
  enabled: boolean;
}) {
  const { isQueryEnabledWithAccessToken } = useAuthenticatedQueryToolkit();

  const { data, ...rest } = useQuery({
    queryKey: ["pack", id],
    queryFn: () => fetchPackById(id),
    enabled: isQueryEnabledWithAccessToken && !!id && enabled,
  });

  return {
    pack: data,
    ...rest,
  };
}
