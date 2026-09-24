import { authPlugin } from '@packrat/api/middleware/auth';
import { enforceFeatureAccess } from '@packrat/api/middleware/featureGate';
import { registerDeviceToken } from '@packrat/api/services/push/deviceTokenService';
import {
  addWatchedLocation,
  listWatchedLocations,
  removeWatchedLocation,
} from '@packrat/api/services/weatherMonitoring/watchListService';
import { FeatureFlag, featureAccessKeyForFlag } from '@packrat/config';
import {
  AddWatchedLocationRequestSchema,
  RegisterDeviceTokenRequestSchema,
} from '@packrat/schemas/weatherMonitoring';
import { Elysia, status } from 'elysia';
import { z } from 'zod';

const WEATHER_MONITORING_ACCESS_KEY = featureAccessKeyForFlag(FeatureFlag.EnableWeatherMonitoring);

function toWatchedLocationResponse(row: { createdAt: Date; [key: string]: unknown }) {
  return { ...row, createdAt: row.createdAt.toISOString() };
}

export const weatherMonitoringRoutes = new Elysia({ prefix: '/weather' })
  .model({
    'weatherMonitoring.AddWatchedLocationRequest': AddWatchedLocationRequestSchema,
    'weatherMonitoring.RegisterDeviceTokenRequest': RegisterDeviceTokenRequestSchema,
  })
  .use(authPlugin)
  .get(
    '/watch-list',
    async ({ user }) => {
      const denied = await enforceFeatureAccess(WEATHER_MONITORING_ACCESS_KEY, user.userId);
      if (denied) return denied;

      const rows = await listWatchedLocations(user.userId);
      return rows.map(toWatchedLocationResponse);
    },
    {
      isAuthenticated: true,
      detail: {
        tags: ['Weather'],
        summary: 'List watched locations',
        security: [{ bearerAuth: [] }],
      },
    },
  )
  .post(
    '/watch-list',
    async ({ body, user }) => {
      const denied = await enforceFeatureAccess(WEATHER_MONITORING_ACCESS_KEY, user.userId);
      if (denied) return denied;

      const row = await addWatchedLocation({ userId: user.userId, request: body });
      return toWatchedLocationResponse(row);
    },
    {
      body: 'weatherMonitoring.AddWatchedLocationRequest',
      isAuthenticated: true,
      detail: {
        tags: ['Weather'],
        summary: 'Add a location to the watch list',
        security: [{ bearerAuth: [] }],
      },
    },
  )
  .delete(
    '/watch-list/:id',
    async ({ params, user }) => {
      const denied = await enforceFeatureAccess(WEATHER_MONITORING_ACCESS_KEY, user.userId);
      if (denied) return denied;

      const removed = await removeWatchedLocation({
        userId: user.userId,
        watchedLocationId: params.id,
      });
      if (!removed) return status(404, { error: 'Watched location not found' });
      return { success: true };
    },
    {
      params: z.object({ id: z.string() }),
      isAuthenticated: true,
      detail: {
        tags: ['Weather'],
        summary: 'Remove a location from the watch list',
        security: [{ bearerAuth: [] }],
      },
    },
  )
  .post(
    '/device-token',
    async ({ body, user }) => {
      const denied = await enforceFeatureAccess(WEATHER_MONITORING_ACCESS_KEY, user.userId);
      if (denied) return denied;

      await registerDeviceToken({ userId: user.userId, request: body });
      return { success: true };
    },
    {
      body: 'weatherMonitoring.RegisterDeviceTokenRequest',
      isAuthenticated: true,
      detail: {
        tags: ['Weather'],
        summary: 'Register a device for weather alert push notifications',
        security: [{ bearerAuth: [] }],
      },
    },
  );
