import type { createDb } from '@packrat/api/db';
import { queryRows } from '@packrat/api/db/queryRows';
import { hasProEntitlement } from '@packrat/api/services/entitlementsService';
import { canAccessFeature } from '@packrat/api/services/featureAccessService';
import { pushToUser } from '@packrat/api/services/push/pushToUser';
import type { TrailDb } from '@packrat/api/services/trailIndex';
import {
  getTripTrailConditions,
  TRIP_NEARBY_RADIUS_M,
} from '@packrat/api/services/tripTrailConditions';
import type { ValidatedEnv } from '@packrat/api/utils/env-validation';
import { captureApiException } from '@packrat/api/utils/sentry';
import { FeatureFlag, featureAccessKeyForFlag } from '@packrat/config';
import {
  notificationPreferences,
  trailConditionReportReads,
  tripConditionNotificationState,
  trips,
} from '@packrat/db/schema';
import { safeJsonStringify } from '@packrat/utils';
import { and, eq, gte, inArray, isNotNull, isNull, lte, ne, or, sql } from 'drizzle-orm';
import { z } from 'zod';

type Db = ReturnType<typeof createDb>;

const DAY_MS = 24 * 60 * 60 * 1000;
/** A trip is upcoming for this long before it starts. */
export const UPCOMING_WINDOW_MS = 14 * DAY_MS;
/** A report counts as recent this long; older ones never mark a trip unread. */
export const RECENT_WINDOW_MS = 14 * DAY_MS;
/** A trip gets at most one trail-conditions notification per this period. */
export const NOTIFY_INTERVAL_MS = DAY_MS;

const ACCESS_KEY = featureAccessKeyForFlag(FeatureFlag.EnableTrailConditionNotifications);

export interface AlertTrip {
  id: string;
  userId: string;
  name: string;
  trailId: string | null;
  location: { latitude: number; longitude: number } | null;
  status: 'planned' | 'in_progress' | 'complete';
  startDate: Date | null;
  endDate: Date | null;
  createdAt: Date;
}

/**
 * Upcoming (starting within two weeks and not yet over) or in progress. A
 * finished trip is history: it gets no marker and no notification.
 */
export function isTripActive({
  trip,
  now,
}: {
  trip: Pick<AlertTrip, 'status' | 'startDate' | 'endDate'>;
  now: Date;
}): boolean {
  if (trip.status === 'complete') return false;
  if (trip.status === 'in_progress') return true;
  if (!trip.startDate) return false;
  const lastDay = trip.endDate ?? trip.startDate;
  return (
    trip.startDate.getTime() <= now.getTime() + UPCOMING_WINDOW_MS &&
    lastDay.getTime() >= now.getTime() - DAY_MS
  );
}

/** SQL twin of `isTripActive`, for picking candidate trips. */
function activeTripsWhere(now: Date) {
  const upcomingFrom = new Date(now.getTime() + UPCOMING_WINDOW_MS);
  const notOverBefore = new Date(now.getTime() - DAY_MS);
  return and(
    eq(trips.deleted, false),
    or(
      eq(trips.status, 'in_progress'),
      and(
        eq(trips.status, 'planned'),
        lte(trips.startDate, upcomingFrom),
        gte(sql`coalesce(${trips.endDate}, ${trips.startDate})`, notOverBefore),
      ),
    ),
  );
}

const tripColumns = {
  id: trips.id,
  userId: trips.userId,
  name: trips.name,
  trailId: trips.trailId,
  location: trips.location,
  status: trips.status,
  startDate: trips.startDate,
  endDate: trips.endDate,
  createdAt: trips.createdAt,
};

function toAlertTrip(row: {
  location: { latitude: number; longitude: number; name?: string } | null;
}): Pick<AlertTrip, 'location'> {
  return {
    location: row.location
      ? { latitude: row.location.latitude, longitude: row.location.longitude }
      : null,
  };
}

/**
 * Which of the viewer's section reports are unread: written by someone else
 * after the trip was planned, still recent, and not yet opened or seen.
 */
export async function unreadReportIds({
  db,
  trip,
  reports,
  viewerId,
  now,
}: {
  db: Db;
  trip: Pick<AlertTrip, 'status' | 'startDate' | 'endDate' | 'createdAt'>;
  reports: { id: string; userId: string; createdAt: Date; localCreatedAt: Date }[];
  viewerId: string;
  now: Date;
}): Promise<Set<string>> {
  if (!isTripActive({ trip, now })) return new Set();
  const candidates = reports.filter(
    (r) =>
      r.userId !== viewerId &&
      r.createdAt.getTime() > trip.createdAt.getTime() &&
      now.getTime() - r.localCreatedAt.getTime() <= RECENT_WINDOW_MS,
  );
  if (candidates.length === 0) return new Set();
  const read = await db
    .tag('trailConditionAlerts.listReads')
    .select({ reportId: trailConditionReportReads.reportId })
    .from(trailConditionReportReads)
    .where(
      and(
        eq(trailConditionReportReads.userId, viewerId),
        inArray(
          trailConditionReportReads.reportId,
          candidates.map((r) => r.id),
        ),
      ),
    );
  const readIds = new Set(read.map((r) => r.reportId));
  return new Set(candidates.filter((r) => !readIds.has(r.id)).map((r) => r.id));
}

/** Records that the viewer has seen these reports. */
export async function markReportsRead({
  db,
  userId,
  reportIds,
}: {
  db: Db;
  userId: string;
  reportIds: string[];
}): Promise<void> {
  if (reportIds.length === 0) return;
  await db
    .tag('trailConditionAlerts.markRead')
    .insert(trailConditionReportReads)
    .values(reportIds.map((reportId) => ({ userId, reportId })))
    .onConflictDoNothing();
}

/** The viewer's upcoming and in-progress trips whose conditions section has an unread report. */
export async function listUnreadTripIds({
  db,
  trailDb,
  userId,
  now,
}: {
  db: Db;
  trailDb: TrailDb | null;
  userId: string;
  now: Date;
}): Promise<string[]> {
  const active = await db
    .tag('trailConditionAlerts.listActiveTrips')
    .select(tripColumns)
    .from(trips)
    .where(and(eq(trips.userId, userId), activeTripsWhere(now)));

  const unread: string[] = [];
  for (const row of active) {
    const trip = { ...row, ...toAlertTrip(row) };
    const section = await getTripTrailConditions({ db, trailDb, trip, viewerId: userId });
    const ids = await unreadReportIds({
      db,
      trip,
      reports: section.reports,
      viewerId: userId,
      now,
    });
    if (ids.size > 0) unread.push(trip.id);
  }
  return unread;
}

export async function getTrailConditionNotificationsEnabled({
  db,
  userId,
}: {
  db: Db;
  userId: string;
}): Promise<boolean> {
  const [row] = await db
    .tag('trailConditionAlerts.getPreference')
    .select({ trailConditions: notificationPreferences.trailConditions })
    .from(notificationPreferences)
    .where(eq(notificationPreferences.userId, userId));
  return row?.trailConditions ?? true;
}

export async function setTrailConditionNotificationsEnabled({
  db,
  userId,
  enabled,
}: {
  db: Db;
  userId: string;
  enabled: boolean;
}): Promise<void> {
  const now = new Date();
  await db
    .tag('trailConditionAlerts.setPreference')
    .insert(notificationPreferences)
    .values({ userId, trailConditions: enabled, updatedAt: now })
    .onConflictDoUpdate({
      target: notificationPreferences.userId,
      set: { trailConditions: enabled, updatedAt: now },
    });
}

const CONDITION_MEANING = Object.freeze({
  excellent: 'In great shape',
  good: 'Good to go',
  fair: 'Passable with care',
  poor: 'Tough going',
} as const);

export function trailReportNotification({
  tripName,
  report,
  nearby,
}: {
  tripName: string;
  report: { trailName: string; overallCondition: string; hazards: string[] };
  nearby: boolean;
}): { title: string; body: string } {
  const meaning =
    CONDITION_MEANING[report.overallCondition as keyof typeof CONDITION_MEANING] ??
    'New conditions';
  const where = nearby ? `${report.trailName}, near your trip` : report.trailName;
  const hazards = report.hazards.length > 0 ? ` ${report.hazards.join(', ')}.` : '';
  return {
    title: `New trail report for ${tripName}`,
    body: `${where}: ${meaning}.${hazards}`,
  };
}

/** Trailless trips whose destination is within the nearby radius of the trail. */
async function tripsNearTrail({
  trailDb,
  trailId,
  candidates,
}: {
  trailDb: TrailDb;
  trailId: string;
  candidates: { id: string; latitude: number; longitude: number }[];
}): Promise<Set<string>> {
  const points = safeJsonStringify(
    candidates.map((c) => ({ trip_id: c.id, lat: c.latitude, lon: c.longitude })),
  );
  const result = await trailDb.tag('trailConditionAlerts.tripsNearTrail').execute(sql`
    SELECT v.trip_id
    FROM jsonb_to_recordset(${points}::jsonb) AS v(trip_id text, lat float8, lon float8)
    JOIN trails t ON t.id::text = ${trailId}
    WHERE ST_DWithin(
      t.geom::geography,
      ST_SetSRID(ST_MakePoint(v.lon, v.lat), 4326)::geography,
      ${TRIP_NEARBY_RADIUS_M}
    )
  `);
  const rows = z.array(z.object({ trip_id: z.string() })).parse(queryRows(result));
  return new Set(rows.map((r) => r.trip_id));
}

/**
 * Notifies the owners of upcoming and in-progress trips that a new report
 * landed in their trip's conditions section: on the trip's trail, or near its
 * destination when it names none. Pinned reports never notify. Each trip gets
 * at most one a day, and an owner who turned these off, can't see the report,
 * or lacks access hears nothing.
 */
export async function notifyTripsOfReport({
  env,
  db,
  trailDb,
  report,
  now,
}: {
  env: ValidatedEnv;
  db: Db;
  trailDb: TrailDb | null;
  report: {
    id: string;
    userId: string;
    trailId: string | null;
    trailName: string;
    overallCondition: string;
    hazards: string[];
  };
  now: Date;
}): Promise<{ notifiedTripIds: string[] }> {
  const trailId = report.trailId;
  if (!trailId) return { notifiedTripIds: [] };

  const rows = await db
    .tag('trailConditionAlerts.candidateTrips')
    .select(tripColumns)
    .from(trips)
    .where(
      and(
        activeTripsWhere(now),
        ne(trips.userId, report.userId),
        or(eq(trips.trailId, trailId), and(isNull(trips.trailId), isNotNull(trips.location))),
      ),
    );

  const onTrail = rows.filter((t) => t.trailId === trailId);
  const trailless = rows.flatMap((t) =>
    t.trailId === null && t.location ? [{ ...t, location: t.location }] : [],
  );
  let near = new Set<string>();
  if (trailDb && trailless.length > 0) {
    near = await tripsNearTrail({
      trailDb,
      trailId,
      candidates: trailless.map((t) => ({
        id: t.id,
        latitude: t.location.latitude,
        longitude: t.location.longitude,
      })),
    });
  }
  const candidates = [...onTrail, ...trailless.filter((t) => near.has(t.id))];
  if (candidates.length === 0) return { notifiedTripIds: [] };

  const ownerIds = [...new Set(candidates.map((t) => t.userId))];
  const muted = await db
    .tag('trailConditionAlerts.listMuted')
    .select({ userId: notificationPreferences.userId })
    .from(notificationPreferences)
    .where(
      and(
        inArray(notificationPreferences.userId, ownerIds),
        eq(notificationPreferences.trailConditions, false),
      ),
    );
  const mutedIds = new Set(muted.map((m) => m.userId));

  const allowed = new Map<string, boolean>();
  for (const ownerId of ownerIds) {
    if (mutedIds.has(ownerId)) continue;
    allowed.set(ownerId, await canAccessFeature(ACCESS_KEY, await hasProEntitlement(ownerId)));
  }

  const notifiedTripIds: string[] = [];
  for (const row of candidates) {
    if (!allowed.get(row.userId)) continue;
    try {
      // The section is what the tap opens, so the report must be in it as the
      // owner sees it: their blocks and flags apply, and nearby keeps its cut.
      const trip = { ...row, ...toAlertTrip(row) };
      const section = await getTripTrailConditions({ db, trailDb, trip, viewerId: row.userId });
      if (!section.reports.some((r) => r.id === report.id)) continue;

      // Claim today's notification before sending, so concurrent reports
      // can't both notify the same trip.
      const cutoff = new Date(now.getTime() - NOTIFY_INTERVAL_MS);
      const claimed = await db
        .tag('trailConditionAlerts.claimNotification')
        .insert(tripConditionNotificationState)
        .values({ tripId: row.id, lastNotifiedAt: now })
        .onConflictDoUpdate({
          target: tripConditionNotificationState.tripId,
          set: { lastNotifiedAt: now },
          setWhere: lte(tripConditionNotificationState.lastNotifiedAt, cutoff),
        })
        .returning();
      if (claimed.length === 0) continue;

      await pushToUser({
        env,
        db,
        userId: row.userId,
        payload: {
          alert: trailReportNotification({
            tripName: row.name,
            report,
            nearby: section.scope === 'nearby',
          }),
          tripId: row.id,
          reportId: report.id,
        },
        operation: 'trailConditionAlerts.push',
        extra: { tripId: row.id, reportId: report.id },
      });
      notifiedTripIds.push(row.id);
    } catch (error) {
      captureApiException({
        error,
        operation: 'trailConditionAlerts.notifyTrip',
        tags: { feature: 'trailConditions' },
        extra: { tripId: row.id, reportId: report.id },
      });
    }
  }
  return { notifiedTripIds };
}
