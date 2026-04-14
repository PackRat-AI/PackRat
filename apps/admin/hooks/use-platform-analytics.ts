'use client';

import { AdminAPI } from 'admin-app/lib/api';
import { useQuery } from '@tanstack/react-query';

export function usePlatformGrowth(period: string) {
  return useQuery({
    queryKey: ['platform', 'growth', period],
    queryFn: () => AdminAPI.platform.growth(period),
  });
}

export function usePlatformActivity(period: string) {
  return useQuery({
    queryKey: ['platform', 'activity', period],
    queryFn: () => AdminAPI.platform.activity(period),
  });
}

export function usePlatformBreakdown() {
  return useQuery({
    queryKey: ['platform', 'breakdown'],
    queryFn: () => AdminAPI.platform.breakdown(),
  });
}
