'use client';

import { useQuery } from '@tanstack/react-query';
import {
  getQueryMetricsByCallSite,
  getQueryMetricsRecent,
  getQueryMetricsSummary,
} from 'admin-app/lib/api';
import { queryKeys } from 'admin-app/lib/queryKeys';

export function useQueryMetricsSummary({
  hours = 24,
  month,
}: {
  hours?: number;
  month?: string;
} = {}) {
  return useQuery({
    queryKey: queryKeys.queryMetrics.summary(month ?? hours),
    queryFn: () => getQueryMetricsSummary({ hours, month }),
    refetchInterval: 60_000,
  });
}

export function useQueryMetricsRecent(limit = 50) {
  return useQuery({
    queryKey: queryKeys.queryMetrics.recent(limit),
    queryFn: () => getQueryMetricsRecent(limit),
    refetchInterval: 30_000,
  });
}

export function useQueryMetricsByCallSite({
  hours = 24,
  limit = 50,
  month,
}: {
  hours?: number;
  limit?: number;
  month?: string;
} = {}) {
  return useQuery({
    queryKey: queryKeys.queryMetrics.byCallSite({ key: month ?? hours, limit }),
    queryFn: () => getQueryMetricsByCallSite({ hours, limit, month }),
    refetchInterval: 60_000,
  });
}
