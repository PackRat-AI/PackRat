import { queryTrpc } from '../../trpc';

export const useUserTrips = (ownerId) => {
  // If ownerId is not provided, don’t run the query.
  const enabled = !!ownerId;

  // Leverage the query hook provided by tRPC
  const { data, error, isLoading, refetch } = queryTrpc.getTrips.useQuery(
    { owner_id: ownerId },
    {
      enabled, // This query will run only if 'enabled' is true.
      refetchOnWindowFocus: false,
      keepPreviousData: true,
    },
  );

  // Extract trips or set an empty array if data is undefined.
  // const trips = data?.trips || [];

  return { data, error, isLoading, refetch };
};
