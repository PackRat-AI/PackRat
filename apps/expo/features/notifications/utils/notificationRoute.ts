import { isNumber, isString } from '@packrat/guards';

/**
 * Where a tapped push should land, from the ids the server puts in its data
 * payload (see packages/api/src/services/push/fcmClient.ts). FCM data values
 * arrive as strings. Returns null for a payload this build cannot route.
 */
export type NotificationRoute =
  | { pathname: '/weather/[id]'; params: { id: string } }
  | { pathname: '/trip/[id]'; params: { id: string } }
  | { pathname: '/feed/[id]'; params: { id: string } };

function idFrom(value: unknown): string | null {
  if (isNumber(value) && Number.isFinite(value)) return String(value);
  if (isString(value) && value.trim() !== '') return value.trim();
  return null;
}

export function notificationRoute(
  data: Record<string, unknown> | null | undefined,
): NotificationRoute | null {
  if (!data) return null;
  const postId = idFrom(data.postId);
  if (postId) return { pathname: '/feed/[id]', params: { id: postId } };
  const tripId = idFrom(data.tripId);
  if (tripId) return { pathname: '/trip/[id]', params: { id: tripId } };
  const weatherLocationId = idFrom(data.weatherLocationId);
  if (weatherLocationId) return { pathname: '/weather/[id]', params: { id: weatherLocationId } };
  return null;
}
