import { DurableObject } from 'cloudflare:workers';
import { listCachedFeatureFlags } from '@packrat/api/services/featureFlagsService';
import {
  type TripWatch,
  tickTripDestination,
  watchWindow,
} from '@packrat/api/services/weatherMonitoring/tripDestinationWatch';
import { type Env, getEnv, setWorkerEnv } from '@packrat/api/utils/env-validation';
import { record } from '@packrat/api/utils/sentry';
import { FeatureFlag } from '@packrat/config';

const WATCH_KEY = 'watch';
const SEEN_IDS_KEY = 'seenIds';

/**
 * One instance per trip (`idFromName(tripId)`). Wakes three days before the
 * trip starts, then every 20 minutes until a day after it ends, checking
 * the destination for weather alerts. It keeps the trip's details itself, so a
 * check never wakes Postgres — Neon is reached only to push a new alert.
 *
 * Postgres stays the source of truth: the stored watch is rebuilt on every trip
 * write and by the daily re-arm, and what was pushed is recorded there.
 */
export class TripDestinationWatcher extends DurableObject<Env> {
  /**
   * Stores the trip's current details and schedules the next run. A timer
   * already running inside the window keeps its slot, so edits and the daily
   * re-arm don't trigger extra weather checks.
   */
  async arm(watch: TripWatch): Promise<void> {
    await this.ctx.storage.put(WATCH_KEY, watch);
    const { opensAt } = watchWindow(watch);
    const now = Date.now();
    if (now < opensAt) {
      await this.ctx.storage.setAlarm(opensAt);
      return;
    }
    if ((await this.ctx.storage.getAlarm()) === null) await this.ctx.storage.setAlarm(now);
  }

  async disarm(): Promise<void> {
    await this.ctx.storage.deleteAlarm();
    await this.ctx.storage.deleteAll();
  }

  override async alarm(): Promise<void> {
    const watch = await this.ctx.storage.get<TripWatch>(WATCH_KEY);
    if (!watch) return;
    const seenIds = (await this.ctx.storage.get<string[]>(SEEN_IDS_KEY)) ?? [];

    setWorkerEnv(this.env as unknown as Record<string, unknown>); // safe-cast: same as the Worker's fetch handler
    const env = getEnv();
    const flags = await listCachedFeatureFlags(env.AUTH_KV);
    const result = await record({
      operation: 'tripReminders.destinationAlarm',
      tags: { trigger: 'alarm' },
      extra: { tripId: watch.tripId },
      fn: async () =>
        tickTripDestination({
          env,
          watch,
          seenIds,
          enabled:
            flags[FeatureFlag.EnableTripReminders] === true ||
            flags[FeatureFlag.EnableTripWeather] === true,
          now: Date.now(),
        }),
    });

    if (result.nextAt === null) {
      await this.ctx.storage.deleteAll();
      return;
    }
    await this.ctx.storage.put(SEEN_IDS_KEY, result.seenIds);
    await this.ctx.storage.setAlarm(result.nextAt);
  }
}
