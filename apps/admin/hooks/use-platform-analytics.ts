'use client';

import { useQuery } from '@tanstack/react-query';
import { getPlatformActivity, getPlatformBreakdown, getPlatformGrowth } from 'admin-app/lib/api';
import { queryKeys } from 'admin-app/lib/queryKeys';

export function usePlatformGrowth(period: 'day' | 'week' | 'month') {
  return useQuery({
    queryKey: queryKeys.platform.growth(period),
    queryFn: () => getPlatformGrowth(period),
  });
}

export function usePlatformActivity(period: 'day' | 'week' | 'month') {
  return useQuery({
    queryKey: queryKeys.platform.activity(period),
    queryFn: () => getPlatformActivity(period),
  });
}

export function usePlatformBreakdown() {
  return useQuery({
    queryKey: queryKeys.platform.breakdown,
    queryFn: () => getPlatformBreakdown(),
  });
}
