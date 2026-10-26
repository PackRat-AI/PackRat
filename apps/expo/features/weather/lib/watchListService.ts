import {
  type AddWatchedLocationRequest,
  WatchedLocationSchema,
} from '@packrat/schemas/weatherMonitoring';
import * as Sentry from '@sentry/react-native';
import { apiClient } from 'expo-app/lib/api/packrat';

function apiError({
  action,
  error,
  extra,
}: {
  action: string;
  error: { status: number; value: unknown };
  extra?: Record<string, unknown>;
}) {
  const err = new Error(String(error.value ?? `Failed to ${action}`));
  Sentry.captureException(err, {
    tags: { feature: 'weatherMonitoring', action },
    extra: { ...extra, apiError: error.value, httpStatus: error.status },
  });
  return err;
}

export async function fetchWatchList() {
  const { data, error } = await apiClient.weather['watch-list'].get();
  if (error) throw apiError({ action: 'fetchWatchList', error });
  return WatchedLocationSchema.array().parse(data ?? []);
}

export async function addWatchedLocation(request: AddWatchedLocationRequest) {
  Sentry.addBreadcrumb({
    category: 'weatherMonitoring',
    message: 'Watching location',
    level: 'info',
    data: { weatherLocationId: request.weatherLocationId },
  });
  const { data, error } = await apiClient.weather['watch-list'].post(request);
  if (error || !data) {
    throw apiError({
      action: 'addWatchedLocation',
      error: error ?? { status: 0, value: 'Empty response' },
      extra: { weatherLocationId: request.weatherLocationId },
    });
  }
  return WatchedLocationSchema.parse(data);
}

export async function removeWatchedLocation(id: string) {
  Sentry.addBreadcrumb({
    category: 'weatherMonitoring',
    message: 'Unwatching location',
    level: 'info',
    data: { watchedLocationId: id },
  });
  const { error } = await apiClient.weather['watch-list']({ id }).delete();
  if (error) throw apiError({ action: 'removeWatchedLocation', error, extra: { id } });
}

export async function registerDeviceToken(deviceToken: string) {
  const { error } = await apiClient.weather['device-token'].post({
    platform: 'android',
    deviceToken,
  });
  if (error) throw apiError({ action: 'registerDeviceToken', error });
}
