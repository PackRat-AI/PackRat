import axios from 'axios';
import axiosInstance, { handleApiError } from 'expo-app/lib/api/client';
import { useEffect, useState } from 'react';

export type NotificationType =
  | 'week_reminder'
  | 'three_day_reminder'
  | 'day_before'
  | 'morning_of'
  | 'pack_progress'
  | 'device_charging';

export type NotificationPriority = 'low' | 'medium' | 'high';

export interface TripNotification {
  tripId: string;
  tripName: string;
  startDate: string | null;
  daysUntilTrip: number | null;
  type: NotificationType;
  title: string;
  message: string;
  priority: NotificationPriority;
}

interface TripRemindersResponse {
  notifications: TripNotification[];
  upcomingTripsCount: number;
}

interface UseTripNotificationsResult {
  notifications: TripNotification[];
  upcomingTripsCount: number;
  isLoading: boolean;
  error: string | null;
  refresh: () => void;
}

export function useTripNotifications(): UseTripNotificationsResult {
  const [notifications, setNotifications] = useState<TripNotification[]>([]);
  const [upcomingTripsCount, setUpcomingTripsCount] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  // biome-ignore lint/correctness/useExhaustiveDependencies: refreshKey is intentionally used to trigger re-fetch
  useEffect(() => {
    const controller = new AbortController();

    async function fetchReminders() {
      setIsLoading(true);
      setError(null);
      try {
        const res = await axiosInstance.get<TripRemindersResponse>(
          '/api/notifications/trip-reminders',
          { signal: controller.signal },
        );
        setNotifications(res.data.notifications ?? []);
        setUpcomingTripsCount(res.data.upcomingTripsCount ?? 0);
      } catch (err) {
        if (!axios.isCancel(err)) {
          const { message } = handleApiError(err);
          setError(message);
        }
      } finally {
        if (!controller.signal.aborted) {
          setIsLoading(false);
        }
      }
    }

    fetchReminders();

    return () => {
      controller.abort();
    };
  }, [refreshKey]);

  return {
    notifications,
    upcomingTripsCount,
    isLoading,
    error,
    refresh: () => setRefreshKey((k) => k + 1),
  };
}
