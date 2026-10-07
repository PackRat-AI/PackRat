import { createDbClient } from '@packrat/api/db';
import type { ValidatedEnv } from '@packrat/api/utils/env-validation';
import { captureApiException } from '@packrat/api/utils/sentry';
import { safetyCheckIns, trips, users } from '@packrat/db/schema';
import { and, eq, isNull, lte, sql } from 'drizzle-orm';
import { contactsFor, displayName, latestLocation, shareUrlFor } from './checkInService';
import { deliverToContacts } from './delivery';
import { overdueMessage } from './messages';

export interface SweepResult {
  alerted: number;
}

/**
 * Runs every five minutes. Once a check-in's expected return plus grace has
 * passed, sends the overdue alert to every contact. Runs on the server so the
 * alert goes out even if the phone is dead. (The hour-before reminder is a
 * local notification on the phone, so it arrives with no signal.)
 *
 * Each row is claimed with a conditional UPDATE before anything is sent, so an
 * overlapping run can never send the same alert twice.
 */
export async function sweepSafetyCheckIns({
  env,
  now = new Date(),
}: {
  env: ValidatedEnv;
  now?: Date;
}): Promise<SweepResult> {
  const db = createDbClient(env);
  const result: SweepResult = { alerted: 0 };

  const overdue = await db
    .tag('safetyCheckIn.claimOverdue')
    .update(safetyCheckIns)
    .set({ overdueAlertSentAt: now })
    .where(
      and(
        eq(safetyCheckIns.status, 'active'),
        isNull(safetyCheckIns.overdueAlertSentAt),
        lte(
          sql`${safetyCheckIns.expectedReturnAt} + make_interval(mins => ${safetyCheckIns.graceMinutes})`,
          now,
        ),
      ),
    )
    .returning();

  for (const checkIn of overdue) {
    try {
      const [trip] = await db
        .tag('safetyCheckIn.getTrip')
        .select({ name: trips.name })
        .from(trips)
        .where(eq(trips.id, checkIn.tripId));
      const [user] = await db
        .tag('safetyCheckIn.getUser')
        .select({ name: users.name, firstName: users.firstName })
        .from(users)
        .where(eq(users.id, checkIn.userId));
      const lastKnown = await latestLocation(checkIn.id);

      await deliverToContacts({
        contacts: await contactsFor(checkIn.id),
        message: overdueMessage({
          userName: user ? displayName(user) : 'Your contact',
          tripName: trip?.name ?? 'their trip',
          overdueMinutes: (now.getTime() - checkIn.expectedReturnAt.getTime()) / 60_000,
          lastKnown,
          timeZone: checkIn.timeZone,
          link: shareUrlFor(checkIn.shareToken),
        }),
        operation: 'overdue',
        checkInId: checkIn.id,
      });
      result.alerted++;
    } catch (error) {
      captureApiException({
        error,
        operation: 'safetyCheckIn.overdue',
        tags: { feature: 'safetyCheckIn' },
        extra: { checkInId: checkIn.id },
      });
    }
  }

  return result;
}
