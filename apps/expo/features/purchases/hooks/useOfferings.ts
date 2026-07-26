import * as Sentry from '@sentry/react-native';
import { useQuery } from '@tanstack/react-query';
import Purchases from 'react-native-purchases';

export const OFFERINGS_QUERY_KEY = ['purchases', 'offerings'] as const;

export function useOfferings() {
  return useQuery({
    queryKey: OFFERINGS_QUERY_KEY,
    queryFn: async () => {
      Sentry.addBreadcrumb({
        category: 'purchases',
        message: 'Fetching offerings',
        level: 'info',
      });
      try {
        return await Purchases.getOfferings();
      } catch (error) {
        Sentry.captureException(error, {
          tags: { feature: 'purchases', action: 'getOfferings' },
        });
        throw error;
      }
    },
    staleTime: 1000 * 60 * 30,
  });
}
