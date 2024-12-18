import { queryTrpc } from 'app/trpc';
import {
  getPaginationInitialParams,
  usePagination,
  type PaginationParams,
} from 'app/hooks/pagination';
import {
  type PreviewResourceStateWithData,
  usePreviewResourceState,
} from 'app/hooks/common';
import { useEffect, useMemo, useState } from 'react';

export const useUserTrips = (
  ownerId: string | undefined,
  params?: { searchTerm?: string; isPublic?: boolean; isPreview?: boolean },
  queryEnabled: boolean = true,
) => {
  const [pagination, setPagination] = useState<PaginationParams>(
    getPaginationInitialParams(),
  );
  const enabled = queryEnabled && !!ownerId;
  const { searchTerm, isPublic, isPreview } = params || {};
  const queryParams = useMemo(
    () => ({
      ownerId,
      searchTerm,
      queryBy: 'Most Recent',
      pagination,
      isPublic,
      isPreview,
    }),
    [isPublic, isPreview, searchTerm, pagination, ownerId],
  );

  // Leverage the query hook provided by tRPC
  const { data, error, isLoading, refetch } =
    queryTrpc.getUserTripsFeed.useQuery(queryParams, {
      enabled, // This query will run only if 'enabled' is true.
      refetchOnWindowFocus: false,
    });

  const { fetchPrevPage, fetchNextPage } = usePagination(
    refetch,
    pagination,
    setPagination,
    {
      prevPage: data?.prevOffset,
      nextPage: data?.nextOffset,
      enabled,
    },
  );

  useEffect(() => {
    setPagination(getPaginationInitialParams());
  }, [searchTerm, ownerId]);

  return {
    data: data?.data || [],
    isLoading,
    totalCount: data?.totalCount,
    refetch,
    fetchPrevPage,
    fetchNextPage,
    hasPrevPage: data?.prevOffset !== false,
    hasNextPage: data?.nextOffset !== false,
    currentPage: data?.currentPage,
    totalPages: data?.totalPages,
    error: null,
  };
};

interface FetchUserTripsPreviewReturn extends PreviewResourceStateWithData {
  totalCount?: number;
  fetchNextPage: () => void;
  nextPage?: number;
}

export const useUserTripsWithPreview = (
  userId: string,
  searchTerm: string,
  isPublic?: boolean,
): FetchUserTripsPreviewReturn => {
  const { isAllQueryEnabled, ...previewResourceState } =
    usePreviewResourceState();
  const {
    data: previewData,
    isLoading: isPreviewLoading,
    totalCount,
  } = useUserTrips(userId, { isPublic, isPreview: true, searchTerm }, true);

  const {
    data: allQueryData,
    isLoading: isAllQueryLoading,
    fetchPrevPage,
    fetchNextPage,
    currentPage,
    totalPages,
    hasPrevPage,
    hasNextPage,
  } = useUserTrips(userId, { isPublic, searchTerm: '' }, isAllQueryEnabled);

  return {
    ...previewResourceState,
    resourceName: 'Trips',
    isAllQueryEnabled,
    previewData,
    isPreviewLoading,
    allQueryData,
    isAllQueryLoading,
    totalCount,
    fetchPrevPage,
    fetchNextPage,
    totalPages,
    currentPage,
    hasPrevPage,
    hasNextPage,
  };
};
