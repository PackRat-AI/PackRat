import { createDb } from '@packrat/api/db';
import { getEnv } from '@packrat/api/utils/env-validation';
import {
  emergencyContacts,
  packItems,
  type SafetyCheckIn as SafetyCheckInRow,
  safetyCheckInContacts,
  safetyCheckInLocations,
  safetyCheckIns,
  trips,
  users,
} from '@packrat/db/schema';
import type {
  SafetyCheckIn,
  SafetyCheckInLocationInput,
  StartSafetyCheckInRequest,
} from '@packrat/schemas/safetyCheckIn';
import { and, asc, desc, eq, inArray, isNull } from 'drizzle-orm';
import { type ContactAddress, deliverToContacts } from './delivery';
import {
  cancelledMessage,
  checkedInMessage,
  introMessage,
  offRouteMessage,
  returnExtendedMessage,
  safeMessage,
  tripStartedMessage,
} from './messages';
import { detectOffRoute, OFF_ROUTE_CONSECUTIVE_FIXES } from './routeDeviation';

const DEFAULT_API_URL = 'https://api.packrat.app';
const TRAILING_SLASH = /\/$/;
const BASE64_PLUS = /\+/g;
const BASE64_SLASH = /\//g;
const BASE64_PADDING = /=+$/;

export class CheckInError extends Error {
  constructor(
    message: string,
    readonly httpStatus: 400 | 404 | 409,
  ) {
    super(message);
    this.name = 'CheckInError';
  }
}

export function shareUrlFor(token: string): string {
  const base = (getEnv().PACKRAT_API_URL ?? DEFAULT_API_URL).replace(TRAILING_SLASH, '');
  return `${base}/api/safety/${token}`;
}

/** 24 random bytes, base64url — unguessable, short enough for an SMS. */
export function generateShareToken(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(24));
  return btoa(String.fromCharCode(...bytes))
    .replace(BASE64_PLUS, '-')
    .replace(BASE64_SLASH, '_')
    .replace(BASE64_PADDING, '');
}

export function overdueAt(checkIn: Pick<SafetyCheckInRow, 'expectedReturnAt' | 'graceMinutes'>) {
  return new Date(checkIn.expectedReturnAt.getTime() + checkIn.graceMinutes * 60_000);
}

export function displayName(user: { name: string; firstName: string | null }): string {
  return user.firstName?.trim() || user.name.trim() || 'Your contact';
}

const locationColumns = Object.freeze({
  id: safetyCheckInLocations.id,
  kind: safetyCheckInLocations.kind,
  latitude: safetyCheckInLocations.latitude,
  longitude: safetyCheckInLocations.longitude,
  placeName: safetyCheckInLocations.placeName,
  note: safetyCheckInLocations.note,
  recordedAt: safetyCheckInLocations.recordedAt,
} as const);

type LocationRow = {
  id: string;
  kind: 'check_in' | 'track';
  latitude: number;
  longitude: number;
  placeName: string | null;
  note: string | null;
  recordedAt: Date;
};

export async function latestLocation(checkInId: string): Promise<LocationRow | null> {
  const db = createDb();
  const [row] = await db
    .tag('safetyCheckIn.latestLocation')
    .select(locationColumns)
    .from(safetyCheckInLocations)
    .where(eq(safetyCheckInLocations.checkInId, checkInId))
    .orderBy(desc(safetyCheckInLocations.recordedAt))
    .limit(1);
  return row ?? null;
}

export async function contactsFor(checkInId: string) {
  const db = createDb();
  return db
    .tag('safetyCheckIn.listCheckInContacts')
    .select({
      contactId: safetyCheckInContacts.contactId,
      name: safetyCheckInContacts.name,
      phone: safetyCheckInContacts.phone,
      email: safetyCheckInContacts.email,
    })
    .from(safetyCheckInContacts)
    .where(eq(safetyCheckInContacts.checkInId, checkInId));
}

async function toResponse(row: SafetyCheckInRow): Promise<SafetyCheckIn> {
  const [contacts, last] = await Promise.all([contactsFor(row.id), latestLocation(row.id)]);
  return {
    id: row.id,
    tripId: row.tripId,
    status: row.status,
    shareUrl: shareUrlFor(row.shareToken),
    expectedReturnAt: row.expectedReturnAt.toISOString(),
    graceMinutes: row.graceMinutes,
    overdueAt: overdueAt(row).toISOString(),
    identifyingGear: row.identifyingGear,
    trackingEnabled: row.trackingEnabled,
    startedAt: row.startedAt.toISOString(),
    overdueAlertSentAt: row.overdueAlertSentAt?.toISOString() ?? null,
    endedAt: row.endedAt?.toISOString() ?? null,
    contacts: contacts.map((c) => ({ contactId: c.contactId, name: c.name })),
    lastLocation: last ? { ...last, recordedAt: last.recordedAt.toISOString() } : null,
  };
}

async function loadOwnedCheckIn(userId: string, checkInId: string): Promise<SafetyCheckInRow> {
  const db = createDb();
  const [row] = await db
    .tag('safetyCheckIn.get')
    .select()
    .from(safetyCheckIns)
    .where(and(eq(safetyCheckIns.id, checkInId), eq(safetyCheckIns.userId, userId)));
  if (!row) throw new CheckInError('Check-in not found', 404);
  return row;
}

async function loadTripAndUser(checkIn: Pick<SafetyCheckInRow, 'tripId' | 'userId'>) {
  const db = createDb();
  const [trip] = await db
    .tag('safetyCheckIn.getTrip')
    .select({ id: trips.id, name: trips.name, plannedRoute: trips.plannedRoute })
    .from(trips)
    .where(eq(trips.id, checkIn.tripId));
  const [user] = await db
    .tag('safetyCheckIn.getUser')
    .select({ name: users.name, firstName: users.firstName })
    .from(users)
    .where(eq(users.id, checkIn.userId));
  if (!trip || !user) throw new CheckInError('Trip not found', 404);
  return { trip, userName: displayName(user) };
}

export async function getActiveCheckInForTrip({
  userId,
  tripId,
}: {
  userId: string;
  tripId: string;
}): Promise<SafetyCheckIn | null> {
  const db = createDb();
  const [row] = await db
    .tag('safetyCheckIn.getActiveForTrip')
    .select()
    .from(safetyCheckIns)
    .where(
      and(
        eq(safetyCheckIns.tripId, tripId),
        eq(safetyCheckIns.userId, userId),
        eq(safetyCheckIns.status, 'active'),
      ),
    )
    .orderBy(desc(safetyCheckIns.createdAt))
    .limit(1);
  return row ? toResponse(row) : null;
}

export async function startCheckIn({
  userId,
  tripId,
  request,
}: {
  userId: string;
  tripId: string;
  request: StartSafetyCheckInRequest;
}): Promise<SafetyCheckIn> {
  const db = createDb();

  // Idempotent: a start replayed by the offline outbox returns what it made.
  const [existing] = await db
    .tag('safetyCheckIn.get')
    .select()
    .from(safetyCheckIns)
    .where(eq(safetyCheckIns.id, request.id));
  if (existing) {
    if (existing.userId !== userId) throw new CheckInError('Check-in id is already in use', 409);
    return toResponse(existing);
  }

  const [trip] = await db
    .tag('safetyCheckIn.getTrip')
    .select({ id: trips.id, name: trips.name })
    .from(trips)
    .where(and(eq(trips.id, tripId), eq(trips.userId, userId), eq(trips.deleted, false)));
  if (!trip) throw new CheckInError('Trip not found', 404);

  const [active] = await db
    .tag('safetyCheckIn.getActiveForTrip')
    .select({ id: safetyCheckIns.id })
    .from(safetyCheckIns)
    .where(and(eq(safetyCheckIns.tripId, tripId), eq(safetyCheckIns.status, 'active')));
  if (active) throw new CheckInError('This trip already has an active check-in', 409);

  const contacts = await db
    .tag('safetyCheckIn.getContactsForStart')
    .select({
      id: emergencyContacts.id,
      name: emergencyContacts.name,
      phone: emergencyContacts.phone,
      email: emergencyContacts.email,
      introducedAt: emergencyContacts.introducedAt,
    })
    .from(emergencyContacts)
    .where(
      and(
        inArray(emergencyContacts.id, request.contactIds),
        eq(emergencyContacts.userId, userId),
        eq(emergencyContacts.deleted, false),
      ),
    );
  if (contacts.length === 0) throw new CheckInError('Choose at least one emergency contact', 400);

  const expectedReturnAt = new Date(request.expectedReturnAt);
  const startedAt = new Date(request.startedAt);
  if (expectedReturnAt <= startedAt) {
    throw new CheckInError('Expected return must be after the trip starts', 400);
  }

  const [row] = await db
    .tag('safetyCheckIn.create')
    .insert(safetyCheckIns)
    .values({
      id: request.id,
      tripId,
      userId,
      shareToken: generateShareToken(),
      expectedReturnAt,
      timeZone: request.timeZone,
      graceMinutes: request.graceMinutes,
      identifyingGear: request.identifyingGear,
      trackingEnabled: request.trackingEnabled,
      startedAt,
    })
    .returning();
  if (!row) throw new Error('Failed to create check-in');

  await db
    .tag('safetyCheckIn.snapshotContacts')
    .insert(safetyCheckInContacts)
    .values(
      contacts.map((c) => ({
        id: crypto.randomUUID(),
        checkInId: row.id,
        contactId: c.id,
        name: c.name,
        phone: c.phone,
        email: c.email,
      })),
    );

  await db
    .tag('safetyCheckIn.markTripStarted')
    .update(trips)
    .set({ status: 'in_progress', startedAt, updatedAt: new Date() })
    .where(eq(trips.id, tripId));

  const { userName } = await loadTripAndUser(row);

  // First message a contact ever receives explains why they're getting it.
  const newContacts = contacts.filter((c) => !c.introducedAt);
  if (newContacts.length > 0) {
    await deliverToContacts({
      contacts: newContacts,
      message: introMessage({ userName }),
      operation: 'intro',
      checkInId: row.id,
    });
    await db
      .tag('safetyCheckIn.markContactsIntroduced')
      .update(emergencyContacts)
      .set({ introducedAt: new Date() })
      .where(
        and(
          inArray(
            emergencyContacts.id,
            newContacts.map((c) => c.id),
          ),
          isNull(emergencyContacts.introducedAt),
        ),
      );
  }

  await deliverToContacts({
    contacts,
    message: tripStartedMessage({
      userName,
      tripName: trip.name,
      expectedReturnAt,
      timeZone: row.timeZone,
      gear: row.identifyingGear,
      link: shareUrlFor(row.shareToken),
    }),
    operation: 'start',
    checkInId: row.id,
  });

  return toResponse(row);
}

export async function extendCheckIn({
  userId,
  checkInId,
  expectedReturnAt,
}: {
  userId: string;
  checkInId: string;
  expectedReturnAt: string;
}): Promise<SafetyCheckIn> {
  const current = await loadOwnedCheckIn(userId, checkInId);
  if (current.status !== 'active') throw new CheckInError('This check-in has ended', 409);

  const next = new Date(expectedReturnAt);
  if (next <= new Date()) throw new CheckInError('Pick a return time in the future', 400);

  const db = createDb();
  const [row] = await db
    .tag('safetyCheckIn.extend')
    .update(safetyCheckIns)
    .set({
      expectedReturnAt: next,
      // A new return time earns a fresh reminder. If the overdue alert already
      // went out, extending doesn't unsend it; it stays recorded so I'm Safe
      // still sends the "safe after all" follow-up.
      reminderSentAt: null,
      updatedAt: new Date(),
    })
    .where(eq(safetyCheckIns.id, checkInId))
    .returning();
  if (!row) throw new CheckInError('Check-in not found', 404);

  const { trip, userName } = await loadTripAndUser(row);
  await deliverToContacts({
    contacts: await contactsFor(row.id),
    message: returnExtendedMessage({
      userName,
      tripName: trip.name,
      expectedReturnAt: next,
      timeZone: row.timeZone,
      link: shareUrlFor(row.shareToken),
    }),
    operation: 'extend',
    checkInId: row.id,
  });

  return toResponse(row);
}

/**
 * Ends a check-in: I'm Safe (`safe`) or called off (`cancelled`). Either way
 * the contacts are told, the public page stops working and every recorded
 * location is deleted. Marking safe also completes the trip.
 */
export async function endCheckIn({
  userId,
  checkInId,
  outcome,
  endedAt,
}: {
  userId: string;
  checkInId: string;
  outcome: 'safe' | 'cancelled';
  endedAt: string;
}): Promise<SafetyCheckIn> {
  const current = await loadOwnedCheckIn(userId, checkInId);
  // Replayed from the outbox after it already landed.
  if (current.status !== 'active') return toResponse(current);

  const db = createDb();
  const ended = new Date(endedAt);
  const [row] = await db
    .tag('safetyCheckIn.end')
    .update(safetyCheckIns)
    .set({ status: outcome, endedAt: ended, updatedAt: new Date() })
    .where(and(eq(safetyCheckIns.id, checkInId), eq(safetyCheckIns.status, 'active')))
    .returning();
  if (!row) return toResponse(await loadOwnedCheckIn(userId, checkInId));

  await db
    .tag('safetyCheckIn.deleteLocations')
    .delete(safetyCheckInLocations)
    .where(eq(safetyCheckInLocations.checkInId, checkInId));

  if (outcome === 'safe') {
    await db
      .tag('safetyCheckIn.markTripComplete')
      .update(trips)
      .set({ status: 'complete', completedAt: ended, updatedAt: new Date() })
      .where(eq(trips.id, row.tripId));
  }

  const { trip, userName } = await loadTripAndUser(row);
  await deliverToContacts({
    contacts: await contactsFor(row.id),
    message:
      outcome === 'safe'
        ? safeMessage({
            userName,
            tripName: trip.name,
            afterOverdueAlert: row.overdueAlertSentAt !== null,
          })
        : cancelledMessage({ userName, tripName: trip.name }),
    operation: outcome,
    checkInId: row.id,
  });

  return toResponse(row);
}

/**
 * Stores locations uploaded from the phone — check-ins and background track
 * points, possibly a batch queued for hours offline. Each new check-in is
 * sent to the contacts; track points feed the map and off-route detection.
 */
export async function addLocations({
  userId,
  checkInId,
  locations,
}: {
  userId: string;
  checkInId: string;
  locations: SafetyCheckInLocationInput[];
}): Promise<{ accepted: number }> {
  const checkIn = await loadOwnedCheckIn(userId, checkInId);
  // A batch arriving after I'm Safe must not resurrect deleted history.
  if (checkIn.status !== 'active') return { accepted: 0 };

  const rows = locations
    .filter((l) => l.kind === 'check_in' || checkIn.trackingEnabled)
    .map((l) => ({
      id: l.id,
      checkInId,
      kind: l.kind,
      latitude: l.latitude,
      longitude: l.longitude,
      accuracyMeters: l.accuracyMeters ?? null,
      placeName: l.placeName ?? null,
      note: l.note ?? null,
      recordedAt: new Date(l.recordedAt),
    }));
  if (rows.length === 0) return { accepted: 0 };

  const db = createDb();
  const inserted = await db
    .tag('safetyCheckIn.insertLocations')
    .insert(safetyCheckInLocations)
    .values(rows)
    .onConflictDoNothing({ target: safetyCheckInLocations.id })
    .returning();
  const newIds = new Set(inserted.map((r) => r.id));

  const { trip, userName } = await loadTripAndUser(checkIn);
  const link = shareUrlFor(checkIn.shareToken);
  const contacts: ContactAddress[] = await contactsFor(checkIn.id);

  const newCheckIns = rows
    .filter((r) => r.kind === 'check_in' && newIds.has(r.id))
    .sort((a, b) => a.recordedAt.getTime() - b.recordedAt.getTime());
  for (const location of newCheckIns) {
    await deliverToContacts({
      contacts,
      message: checkedInMessage({
        userName,
        tripName: trip.name,
        location,
        note: location.note,
        timeZone: checkIn.timeZone,
        link,
      }),
      operation: 'checkIn',
      checkInId,
    });
  }

  if (newIds.size > 0 && trip.plannedRoute && !checkIn.offRouteNotifiedAt) {
    const recent = await db
      .tag('safetyCheckIn.recentLocations')
      .select({
        latitude: safetyCheckInLocations.latitude,
        longitude: safetyCheckInLocations.longitude,
      })
      .from(safetyCheckInLocations)
      .where(eq(safetyCheckInLocations.checkInId, checkInId))
      .orderBy(desc(safetyCheckInLocations.recordedAt))
      .limit(OFF_ROUTE_CONSECUTIVE_FIXES);
    const distance = detectOffRoute(recent.reverse(), trip.plannedRoute);
    if (distance !== null) {
      // Claim the notification first so concurrent uploads can't double-send.
      const [claimed] = await db
        .tag('safetyCheckIn.claimOffRoute')
        .update(safetyCheckIns)
        .set({ offRouteNotifiedAt: new Date(), updatedAt: new Date() })
        .where(and(eq(safetyCheckIns.id, checkInId), isNull(safetyCheckIns.offRouteNotifiedAt)))
        .returning();
      if (claimed) {
        await deliverToContacts({
          contacts,
          message: offRouteMessage({
            userName,
            tripName: trip.name,
            distanceMeters: distance,
            link,
          }),
          operation: 'offRoute',
          checkInId,
        });
      }
    }
  }

  return { accepted: newIds.size };
}

/** Everything the public contacts page shows. Null once the check-in ended. */
export async function getPublicView(token: string) {
  const db = createDb();
  const [checkIn] = await db
    .tag('safetyCheckIn.getByToken')
    .select()
    .from(safetyCheckIns)
    .where(and(eq(safetyCheckIns.shareToken, token), eq(safetyCheckIns.status, 'active')));
  if (!checkIn) return null;

  const [trip] = await db
    .tag('safetyCheckIn.getTripForPage')
    .select({
      name: trips.name,
      location: trips.location,
      startDate: trips.startDate,
      endDate: trips.endDate,
      packId: trips.packId,
      plannedRoute: trips.plannedRoute,
    })
    .from(trips)
    .where(eq(trips.id, checkIn.tripId));
  const [user] = await db
    .tag('safetyCheckIn.getUser')
    .select({ name: users.name, firstName: users.firstName })
    .from(users)
    .where(eq(users.id, checkIn.userId));
  if (!trip || !user) return null;

  const locations = await db
    .tag('safetyCheckIn.listLocations')
    .select(locationColumns)
    .from(safetyCheckInLocations)
    .where(eq(safetyCheckInLocations.checkInId, checkIn.id))
    .orderBy(asc(safetyCheckInLocations.recordedAt));

  const gear = trip.packId
    ? await db
        .tag('safetyCheckIn.listGearForPage')
        .select({
          name: packItems.name,
          quantity: packItems.quantity,
          category: packItems.category,
          worn: packItems.worn,
        })
        .from(packItems)
        .where(and(eq(packItems.packId, trip.packId), eq(packItems.deleted, false)))
        .orderBy(asc(packItems.category), asc(packItems.name))
    : [];

  return { checkIn, trip, userName: displayName(user), locations, gear };
}

export type PublicCheckInView = NonNullable<Awaited<ReturnType<typeof getPublicView>>>;
