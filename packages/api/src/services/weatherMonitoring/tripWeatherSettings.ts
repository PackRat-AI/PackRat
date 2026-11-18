import type { createDb } from '@packrat/api/db';
import { notificationPreferences } from '@packrat/db/schema';
import { eq } from 'drizzle-orm';

type Db = ReturnType<typeof createDb>;

/** Whether the user gets pushes about weather alerts at their trips' destinations. */
export async function getTripWeatherNotificationsEnabled({
  db,
  userId,
}: {
  db: Db;
  userId: string;
}): Promise<boolean> {
  const [row] = await db
    .tag('tripWeather.getPreference')
    .select({ tripWeather: notificationPreferences.tripWeather })
    .from(notificationPreferences)
    .where(eq(notificationPreferences.userId, userId));
  return row?.tripWeather ?? true;
}

export async function setTripWeatherNotificationsEnabled({
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
    .tag('tripWeather.setPreference')
    .insert(notificationPreferences)
    .values({ userId, tripWeather: enabled, updatedAt: now })
    .onConflictDoUpdate({
      target: notificationPreferences.userId,
      set: { tripWeather: enabled, updatedAt: now },
    });
}
