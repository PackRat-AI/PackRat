import { createDb } from '@packrat/api/db';
import { getEnv } from '@packrat/api/utils/env-validation';
import { captureApiException } from '@packrat/api/utils/sentry';
import { weatherWatchedLocations } from '@packrat/db/schema';
import type { AddWatchedLocationRequest } from '@packrat/schemas/weatherMonitoring';
import { and, eq } from 'drizzle-orm';
import { announceActiveAlertsToNewWatcher } from './announceToNewWatcher';
import { armWatchedPlaceTimer, disarmWatchedPlaceTimer } from './watchedPlaceTimer';

export type WatchedLocationRow = {
  id: string;
  weatherLocationId: number;
  locationName: string;
  region: string | null;
  country: string | null;
  lat: number;
  lon: number;
  createdAt: Date;
};

const SELECT_COLUMNS = {
  id: weatherWatchedLocations.id,
  weatherLocationId: weatherWatchedLocations.weatherLocationId,
  locationName: weatherWatchedLocations.locationName,
  region: weatherWatchedLocations.region,
  country: weatherWatchedLocations.country,
  lat: weatherWatchedLocations.lat,
  lon: weatherWatchedLocations.lon,
  createdAt: weatherWatchedLocations.createdAt,
} as const;

export async function listWatchedLocations(userId: string): Promise<WatchedLocationRow[]> {
  const db = createDb();
  let rows: WatchedLocationRow[];
  try {
    rows = await db
      .tag('weatherMonitoring.listWatchedLocations')
      .select(SELECT_COLUMNS)
      .from(weatherWatchedLocations)
      .where(eq(weatherWatchedLocations.userId, userId));
  } catch (error) {
    captureApiException({
      error,
      operation: 'weatherMonitoring.listWatchedLocations',
      userId,
      tags: { feature: 'weatherMonitoring' },
    });
    throw error;
  }
  return rows;
}

/**
 * Adds a location to a user's watch list. Idempotent on the (user, location)
 * pair — re-adding an already-watched location returns the existing row
 * rather than erroring, since "make sure this is watched" is what the
 * contextual add-to-watch-list prompt actually means (see
 * docs/features/weather-alerts.md ADR-002/ADR-003).
 */
export async function addWatchedLocation({
  userId,
  request,
}: {
  userId: string;
  request: AddWatchedLocationRequest;
}): Promise<WatchedLocationRow> {
  const db = createDb();
  try {
    const [row] = await db
      .tag('weatherMonitoring.addWatchedLocation')
      .insert(weatherWatchedLocations)
      .values({
        id: crypto.randomUUID(),
        userId,
        weatherLocationId: request.weatherLocationId,
        locationName: request.locationName,
        region: request.region ?? null,
        country: request.country ?? null,
        lat: request.lat,
        lon: request.lon,
      })
      .onConflictDoUpdate({
        target: [weatherWatchedLocations.userId, weatherWatchedLocations.weatherLocationId],
        // No-op update (touches updatedAt) so onConflictDoUpdate still
        // returns the existing row rather than requiring a second lookup.
        set: { updatedAt: new Date() },
      })
      // Drizzle 0.45.x narrows the insert query type after
      // `.onConflictDoUpdate()` so the field-projected `.returning()`
      // overload isn't visible — only the no-arg version compiles (same
      // note as featureFlagsService.ts). Not a fat table, so shipping the
      // full (small) row is fine.
      .returning();

    if (!row) throw new Error('Failed to add watched location');
    await armWatchedPlaceTimer({ weatherLocationId: row.weatherLocationId });
    // Both timestamps default to the same now() on insert; a re-add bumps
    // updatedAt, so equal means this user just started watching.
    if (row.createdAt.getTime() === row.updatedAt.getTime()) {
      await announceToNewWatcher({ userId, weatherLocationId: row.weatherLocationId });
    }
    return row;
  } catch (error) {
    captureApiException({
      error,
      operation: 'weatherMonitoring.addWatchedLocation',
      userId,
      tags: { feature: 'weatherMonitoring' },
      extra: { weatherLocationId: request.weatherLocationId },
    });
    throw error;
  }
}

/**
 * Best effort: the watch has already been saved, and failing to catch the new
 * watcher up must not fail the request.
 */
async function announceToNewWatcher({
  userId,
  weatherLocationId,
}: {
  userId: string;
  weatherLocationId: number;
}): Promise<void> {
  try {
    await announceActiveAlertsToNewWatcher({ env: getEnv(), userId, weatherLocationId });
  } catch (error) {
    captureApiException({
      error,
      operation: 'weatherMonitoring.announceToNewWatcher',
      userId,
      tags: { feature: 'weatherMonitoring' },
      extra: { weatherLocationId },
    });
  }
}

/**
 * Returns false if no matching row existed for this user. Stops the place's
 * timer when this was its last watcher.
 */
export async function removeWatchedLocation({
  userId,
  watchedLocationId,
}: {
  userId: string;
  watchedLocationId: string;
}): Promise<boolean> {
  const db = createDb();
  try {
    const deleted = await db
      .tag('weatherMonitoring.removeWatchedLocation')
      .delete(weatherWatchedLocations)
      .where(
        and(
          eq(weatherWatchedLocations.id, watchedLocationId),
          eq(weatherWatchedLocations.userId, userId),
        ),
      )
      // The tagged delete only exposes the no-arg `.returning()` (same Drizzle
      // narrowing as the insert above); the row is small.
      .returning();
    const [removed] = deleted;
    if (!removed) return false;

    const [stillWatched] = await db
      .tag('weatherMonitoring.findWatcherOfLocation')
      .select({ id: weatherWatchedLocations.id })
      .from(weatherWatchedLocations)
      .where(eq(weatherWatchedLocations.weatherLocationId, removed.weatherLocationId))
      .limit(1);
    if (!stillWatched) {
      await disarmWatchedPlaceTimer({ weatherLocationId: removed.weatherLocationId });
    }
    return true;
  } catch (error) {
    captureApiException({
      error,
      operation: 'weatherMonitoring.removeWatchedLocation',
      userId,
      tags: { feature: 'weatherMonitoring' },
      extra: { watchedLocationId },
    });
    throw error;
  }
}
