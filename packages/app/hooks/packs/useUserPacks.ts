import { getQueryKey } from '@trpc/react-query';
import { queryClient } from 'app/constants/queryClient';
import { queryTrpc } from '../../trpc';

export const useUserPacks = (ownerId, queryString = '') => {
  const utils = queryTrpc.useContext();
  // If ownerId is not provided, don’t run the query.
  const enabled = !!ownerId;
  // Leverage the query hook provided by tRPC
  // ...
  const { data, error, isLoading, refetch } = queryTrpc.getPacks.useQuery(
    { ownerId, queryBy: queryString },
    {
      enabled, // This query will run only if 'enabled' is true.
      refetchOnWindowFocus: true,
      keepPreviousData: true,
    },
  );
  utils.getPacks.setData({
    ownerId,
    queryBy: queryString,
  });

  // Extract packs or set an empty array if data is undefined.
  const packs = data?.packs || [];

  return { data: packs, error, isLoading, refetch };
};
