import { createDbClient } from '@packrat/api/db';
import { sendApnsPush } from '@packrat/api/services/push/apnsClient';
import type { ValidatedEnv } from '@packrat/api/utils/env-validation';
import { captureApiException } from '@packrat/api/utils/sentry';
import { safetyCheckIns, trips, userDeviceTokens, users } from '@packrat/db/schema';
import { and, eq, isNull, lte, sql } from 'drizzle-orm';
import { contactsFor, displayName, latestLocation, shareUrlFor } from './checkInService';
import { deliverToContacts } from './delivery';
import { overdueMessage, returnReminderNotification } from './messages';

/** How long before the expected return the user is reminded. */
export const REMINDER_LEAD_MINUTES = 60;

export interface SweepResult {
  reminded: number;
  alerted: number;
}

/**
 * Runs every five minutes. Sends the pre-return reminder push to the user and,
 * once the expected return plus grace has passed, the overdue alert to every
 * contact. Runs on the server so the alert goes out even if the phone is dead.
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
  const result: SweepResult = { reminded: 0, alerted: 0 };

  const reminders = await db
    .tag('safetyCheckIn.claimReminders')
    .update(safetyCheckIns)
    .set({ reminderSentAt: now })
    .where(
      and(
        eq(safetyCheckIns.status, 'active'),
        isNull(safetyCheckIns.reminderSentAt),
        isNull(safetyCheckIns.overdueAlertSentAt),
        lte(
          sql`${safetyCheckIns.expectedReturnAt} - make_interval(mins => ${REMINDER_LEAD_MINUTES})`,
          now,
        ),
      ),
    )
    .returning();

  for (const checkIn of reminders) {
    try {
      const [trip] = await db
        .tag('safetyCheckIn.getTrip')
        .select({ name: trips.name })
        .from(trips)
        .where(eq(trips.id, checkIn.tripId));
      const tokens = await db
        .tag('safetyCheckIn.listDeviceTokens')
        .select({ deviceToken: userDeviceTokens.deviceToken })
        .from(userDeviceTokens)
        .where(eq(userDeviceTokens.userId, checkIn.userId));
      const alert = returnReminderNotification({
        tripName: trip?.name ?? 'your trip',
        expectedReturnAt: checkIn.expectedReturnAt,
        timeZone: checkIn.timeZone,
      });
      for (const { deviceToken } of tokens) {
        if (!env.APNS_BUNDLE_ID) break;
        await sendApnsPush({ env, deviceToken, payload: { alert, tripId: checkIn.tripId } });
      }
      result.reminded++;
    } catch (error) {
      captureApiException({
        error,
        operation: 'safetyCheckIn.reminder',
        tags: { feature: 'safetyCheckIn' },
        extra: { checkInId: checkIn.id },
      });
    }
  }

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
