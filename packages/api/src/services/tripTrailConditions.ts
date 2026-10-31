import type { createDb } from '@packrat/api/db';
import { queryRows } from '@packrat/api/db/queryRows';
import { visibleToViewer } from '@packrat/api/services/reportVisibility';
import type { TrailDb } from '@packrat/api/services/trailIndex';
import { captureApiException } from '@packrat/api/utils/sentry';
import { type TrailConditionReport as ReportRow, trailConditionReports } from '@packrat/db/schema';
import { and, between, desc, eq, inArray, isNull, sql } from 'drizzle-orm';
import { z } from 'zod';

type Db = ReturnType<typeof createDb>;

/** How far from a trip's destination a trail still counts as "near it". */
export const TRIP_NEARBY_RADIUS_M = 25_000;
/** Reports the trip section shows. */
export const TRIP_REPORT_LIMIT = 5;

const EARTH_RADIUS_M = 6_371_000;
const METERS_PER_DEGREE_LAT = 111_320;
// Nearest-trail candidates fetched from the trail database before the radius cut.
const NEARBY_TRAIL_CANDIDATES = 200;

export interface Point {
  latitude: number;
  longitude: number;
}

export type TripReport = ReportRow & { distanceM: number | null };

export interface TripTrailConditions {
  /** `trail`: the trip names its trail. `nearby`: trails close to its destination. `none`: nowhere to look. */
  scope: 'trail' | 'nearby' | 'none';
  reports: TripReport[];
}

export function distanceMeters({ from: a, to: b }: { from: Point; to: Point }): number {
  const rad = (d: number) => (d * Math.PI) / 180;
  const dLat = rad(b.latitude - a.latitude);
  const dLon = rad(b.longitude - a.longitude);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(rad(a.latitude)) * Math.cos(rad(b.latitude)) * Math.sin(dLon / 2) ** 2;
  return 2 * EARTH_RADIUS_M * Math.asin(Math.sqrt(h));
}

/**
 * Orders what's near a destination: each report labelled with how far its
 * trail (or pin) is, nearest first, newest first within the same distance.
 * Trail reports arrive one per trail already (the latest), so a busy trail
 * can't crowd its neighbours out of a five-row section.
 */
export function rankNearbyReports({
  origin,
  trailDistances,
  trailReports,
  pinReports,
  limit = TRIP_REPORT_LIMIT,
}: {
  origin: Point;
  trailDistances: Map<string, number>;
  trailReports: ReportRow[];
  pinReports: ReportRow[];
  limit?: number;
}): TripReport[] {
  const fromTrails = trailReports.flatMap((r) => {
    const d = r.trailId ? trailDistances.get(r.trailId) : undefined;
    return d === undefined ? [] : [{ ...r, distanceM: Math.round(d) }];
  });
  const fromPins = pinReports.flatMap((r) => {
    if (r.latitude === null || r.longitude === null) return [];
    const d = distanceMeters({
      from: origin,
      to: { latitude: r.latitude, longitude: r.longitude },
    });
    return d <= TRIP_NEARBY_RADIUS_M ? [{ ...r, distanceM: Math.round(d) }] : [];
  });
  return [...fromTrails, ...fromPins]
    .sort(
      (a, b) =>
        a.distanceM - b.distanceM || b.localCreatedAt.getTime() - a.localCreatedAt.getTime(),
    )
    .slice(0, limit);
}

/** Trails within the trip radius of `origin`, by id, with their distance in metres. */
async function nearbyTrailDistances({
  trailDb,
  origin,
}: {
  trailDb: TrailDb;
  origin: Point;
}): Promise<Map<string, number>> {
  const point = sql`ST_SetSRID(ST_MakePoint(${origin.longitude}, ${origin.latitude}), 4326)`;
  const result = await trailDb.tag('tripTrailConditions.nearbyTrails').execute(sql`
    SELECT id::text, ST_Distance(geom::geography, ${point}::geography) AS distance_m
    FROM trails
    ORDER BY geom <-> ${point}
    LIMIT ${NEARBY_TRAIL_CANDIDATES}
  `);
  const rows = z
    .array(z.object({ id: z.string(), distance_m: z.number() }))
    .parse(queryRows(result));
  return new Map(
    rows.filter((r) => r.distance_m <= TRIP_NEARBY_RADIUS_M).map((r) => [r.id, r.distance_m]),
  );
}

export async function getTripTrailConditions({
  db,
  trailDb,
  trip,
  viewerId,
}: {
  db: Db;
  /** Null when the trail database isn't configured; nearby then means pins only. */
  trailDb: TrailDb | null;
  trip: { id: string; trailId: string | null; location: Point | null };
  /** Whose view this is: their flags and blocks hide reports. */
  viewerId: string;
}): Promise<TripTrailConditions> {
  // biome-ignore lint/style/noNonNullAssertion: and() of defined conditions is never undefined
  const active = and(eq(trailConditionReports.deleted, false), visibleToViewer({ db, viewerId }))!;

  if (trip.trailId) {
    const reports = await db
      .tag('tripTrailConditions.trailReports')
      .select()
      .from(trailConditionReports)
      .where(and(active, eq(trailConditionReports.trailId, trip.trailId)))
      .orderBy(desc(trailConditionReports.localCreatedAt))
      .limit(TRIP_REPORT_LIMIT);
    return { scope: 'trail', reports: reports.map((r) => ({ ...r, distanceM: null })) };
  }

  const origin = trip.location;
  if (!origin) return { scope: 'none', reports: [] };

  let trailDistances = new Map<string, number>();
  if (trailDb) {
    try {
      trailDistances = await nearbyTrailDistances({ trailDb, origin });
    } catch (error) {
      // Pins still answer the question; a trail-db outage shouldn't blank the section.
      captureApiException({
        error,
        operation: 'tripTrailConditions.nearbyTrails',
        extra: { tripId: trip.id },
      });
    }
  }

  const trailIds = [...trailDistances.keys()];
  const trailReports =
    trailIds.length === 0
      ? []
      : await db
          .tag('tripTrailConditions.nearbyTrailReports')
          .selectDistinctOn([trailConditionReports.trailId])
          .from(trailConditionReports)
          .where(and(active, inArray(trailConditionReports.trailId, trailIds)))
          .orderBy(trailConditionReports.trailId, desc(trailConditionReports.localCreatedAt));

  const dLat = TRIP_NEARBY_RADIUS_M / METERS_PER_DEGREE_LAT;
  const dLon =
    TRIP_NEARBY_RADIUS_M /
    (METERS_PER_DEGREE_LAT * Math.max(Math.cos((origin.latitude * Math.PI) / 180), 0.01));
  const pinReports = await db
    .tag('tripTrailConditions.nearbyPinReports')
    .select()
    .from(trailConditionReports)
    .where(
      and(
        active,
        isNull(trailConditionReports.trailId),
        between(trailConditionReports.latitude, origin.latitude - dLat, origin.latitude + dLat),
        between(trailConditionReports.longitude, origin.longitude - dLon, origin.longitude + dLon),
      ),
    )
    .orderBy(desc(trailConditionReports.localCreatedAt))
    .limit(50);

  return {
    scope: 'nearby',
    reports: rankNearbyReports({ origin, trailDistances, trailReports, pinReports }),
  };
}
