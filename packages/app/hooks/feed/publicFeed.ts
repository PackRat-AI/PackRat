import { queryTrpc } from '../../trpc';

export const usePublicFeed = (queryString, selectedTypes) => {
  let data = [];
  let isLoading = true;
  try {
    const queryOptions = {
      refetchOnWindowFocus: false,
      keepPreviousData: true,
      staleTime: 1000 * 60, // 1 min
      cacheTime: 1000 * 60 * 5, // 5 min
    };

    const publicPacks = queryTrpc.getPublicPacks.useQuery(
      { queryBy: queryString ?? 'Favorite' },
      {
        ...queryOptions,
        onSuccess: (data) =>
          console.log('Successfully fetched public packs!', data),
        onError: (error) =>
          console.error('Error fetching public packs:', error),
      },
    );

    const publicTrips = queryTrpc.getPublicTripsRoute.useQuery(
      { queryBy: queryString ?? 'Favorite' },
      {
        ...queryOptions,
        enabled: publicPacks?.status === 'success',
      },
    );

    isLoading =
      publicPacks?.status !== 'success' && publicTrips?.status !== 'success';

    if (selectedTypes.pack && publicPacks?.status === 'success')
      data = [
        ...data,
        ...publicPacks.data.map((item) => ({ ...item, type: 'pack' })),
      ];

    if (selectedTypes.trip && publicTrips?.status === 'success')
      data = [
        ...data,
        ...publicTrips.data.map((item) => ({ ...item, type: 'trip' })),
      ];
  } catch (error) {
    console.error(error);
    return { data: null, error, isLoading };
  }

  return { data, error: null, isLoading };
};
