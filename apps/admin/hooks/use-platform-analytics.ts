'use client';

import { useQuery } from '@tanstack/react-query';
import { getPlatformActivity, getPlatformBreakdown, getPlatformGrowth } from 'admin-app/lib/api';

export function usePlatformGrowth(period: string) {
  return useQuery({
    queryKey: ['platform', 'growth', period],
    queryFn: () => getPlatformGrowth(period),
  });
}

export function usePlatformActivity(period: string) {
  return useQuery({
    queryKey: ['platform', 'activity', period],
    queryFn: () => getPlatformActivity(period),
  });
}

export function usePlatformBreakdown() {
  return useQuery({
    queryKey: ['platform', 'breakdown'],
    queryFn: () => getPlatformBreakdown(),
  });
}
