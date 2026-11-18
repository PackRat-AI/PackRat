import { observable } from '@legendapp/state';
import { syncObservable } from '@legendapp/state/sync';
import * as Sentry from '@sentry/react-native';
import { contactSummary } from 'expo-app/features/safety-check-in/lib/copy';
import {
  ensureSafetyChannel,
  SAFETY_CHANNEL_ID,
} from 'expo-app/features/safety-check-in/lib/safetyNotifications';
import { safetyStore } from 'expo-app/features/safety-check-in/store/safetyCheckIn';
import { tripConditionsStore } from 'expo-app/features/trips/store/tripReminders';
import type { Trip } from 'expo-app/features/trips/types';
import { apiClient } from 'expo-app/lib/api/packrat';
import { t } from 'expo-app/lib/i18n';
import { persistPlugin } from 'expo-app/lib/persist-plugin';
import { delay } from 'expo-app/modules/wake-word';
import * as Battery from 'expo-battery';
import * as Network from 'expo-network';
import * as Notifications from 'expo-notifications';
import * as Speech from 'expo-speech';
import { voiceSettingsStore } from '../store/voiceSettings';
import { voiceStore } from '../store/voiceStore';
import { lastSample } from '../utils/recordedTrack';
import {
  batteryKey,
  dueSafetyAlerts,
  type SafetyAlert,
  type WeatherWarning,
} from '../utils/safetyAlerts';
import { trackStore } from './trackRecorder';
import { say } from './voiceIO';

/**
 * Speaks up during a trip for what the user needs to know straight away: a severe weather alert
 * where they are, an hour left before their contacts are told they're overdue, and a battery low
 * enough to cut tracking short. Each is said once per trip. Runs while PackRat is awake, which
 * tracking, guidance and hands-free keep it; the check-in reminders are scheduled notifications,
 * so they arrive either way.
 */

const CHECK_INTERVAL_MS = 60_000;
/** Weather where the user is gets refetched this often while online. */
const WEATHER_INTERVAL_MS = 30 * 60_000;
/** How long an alert waits for a command or a guidance prompt to finish, in steps of two seconds. */
const BUSY_WAIT_STEPS = 60;

/** The alerts already said, for the trip in progress only. */
const announcedStore = observable<{ tripId: string | null; keys: string[] }>({
  tripId: null,
  keys: [],
});

syncObservable(announcedStore, {
  persist: { plugin: persistPlugin, name: 'voiceSafetyAlertsAnnounced' },
});

let watching: { trip: Trip; run: number } | null = null;
/** Bumped on every change of trip, so an old loop stops at its next step. */
let generation = 0;
let weatherCheckedAt = 0;
let liveWeather: WeatherWarning[] = [];

/** Call whenever the trip in progress changes; null when there's none or voice is off. */
export function syncSafetyAnnouncer(trip: Trip | null): void {
  if (watching && trip && watching.trip.id === trip.id) {
    watching.trip = trip;
    return;
  }
  generation++;
  watching = null;
  liveWeather = [];
  weatherCheckedAt = 0;
  if (!trip) return;
  const run = generation;
  watching = { trip, run };
  void loop(run);
}

async function loop(run: number): Promise<void> {
  // The native delay keeps time with the screen off, which JS timers don't.
  while (run === generation) {
    try {
      await check(run);
    } catch (error) {
      Sentry.captureException(error, {
        tags: { feature: 'voiceCommands', action: 'safetyAlertCheck' },
        extra: { tripId: watching?.trip.id },
      });
    }
    await delay(CHECK_INTERVAL_MS);
  }
}

async function check(run: number): Promise<void> {
  const trip = watching?.trip;
  if (!trip || run !== generation) return;
  const now = new Date();
  await refreshWeather({ trip, now: now.getTime() });
  if (run !== generation) return;

  const checkIn = safetyStore.active.peek()[trip.id];
  const track = trackStore.track.peek();
  const cached = tripConditionsStore.peek()[trip.id]?.alerts ?? [];
  const alerts = dueSafetyAlerts({
    checkIn,
    contacts: checkIn ? contactSummary({ names: checkIn.contactNames, t }) : '',
    battery: await batteryState(),
    weather: [...liveWeather, ...cached],
    tracking: track?.tripId === trip.id,
    now,
  });

  const announced = announcedKeys(trip.id);
  for (const alert of alerts) {
    if (announced.has(alert.key) || run !== generation) continue;
    announced.add(alert.key);
    // A drop straight to 10% skips the 20% warning.
    if (alert.key === batteryKey(10)) announced.add(batteryKey(20));
    announcedStore.set({ tripId: trip.id, keys: [...announced] });
    await deliver({ alert, trip });
  }
}

function announcedKeys(tripId: string): Set<string> {
  const saved = announcedStore.peek();
  return new Set(saved.tripId === tripId ? saved.keys : []);
}

async function batteryState(): Promise<{ level: number; charging: boolean } | null> {
  try {
    const [level, state] = await Promise.all([
      Battery.getBatteryLevelAsync(),
      Battery.getBatteryStateAsync(),
    ]);
    if (level < 0) return null;
    const charging = state === Battery.BatteryState.CHARGING || state === Battery.BatteryState.FULL;
    return { level, charging };
  } catch {
    return null;
  }
}

// ── Weather ───────────────────────────────────────────────────────────────

/**
 * Alerts where the user is now: the recording's latest point, otherwise the trip's destination.
 * Offline, the last result stands.
 */
async function refreshWeather({ trip, now }: { trip: Trip; now: number }): Promise<void> {
  if (now - weatherCheckedAt < WEATHER_INTERVAL_MS || !(await isOnline())) return;
  const track = trackStore.track.peek();
  const sample = track?.tripId === trip.id ? lastSample(track) : null;
  const point = sample ?? trip.location;
  if (!point) return;
  weatherCheckedAt = now;
  const { data, error } = await apiClient.weather['by-name'].get({
    query: { q: `${point.latitude},${point.longitude}` },
  });
  if (error || !data) {
    Sentry.captureException(error?.value ?? error, {
      tags: { feature: 'voiceCommands', action: 'safetyAlertWeather' },
      extra: { tripId: trip.id, httpStatus: error?.status },
    });
    return;
  }
  liveWeather = (data.alerts?.alert ?? []).flatMap((alert) => {
    const event = alert.event || alert.headline;
    return event ? [{ event, headline: alert.headline, severity: alert.severity }] : [];
  });
}

async function isOnline(): Promise<boolean> {
  try {
    const state = await Network.getNetworkStateAsync();
    return Boolean(state.isConnected && state.isInternetReachable !== false);
  } catch {
    return false;
  }
}

// ── Saying it ─────────────────────────────────────────────────────────────

async function deliver({ alert, trip }: { alert: SafetyAlert; trip: Trip }): Promise<void> {
  Sentry.addBreadcrumb({
    category: 'voiceCommands',
    message: 'Safety alert',
    level: 'info',
    data: { key: alert.key, tripId: trip.id },
  });
  await notify({ alert, trip });
  if (voiceSettingsStore.safetyAlertsSpoken.peek() === false) return;
  // Waits for a command or a guidance prompt to finish rather than talking over it.
  for (let step = 0; step < BUSY_WAIT_STEPS; step++) {
    const phase = voiceStore.phase.peek();
    const busy =
      phase === 'listening' ||
      phase === 'confirming' ||
      phase === 'working' ||
      (await Speech.isSpeakingAsync());
    if (!busy) break;
    await delay(2_000);
  }
  await say(alert.text);
}

/**
 * The overdue reminder is already scheduled; the rest get one now, so there's something to read
 * back if the alert wasn't heard.
 */
async function notify({ alert, trip }: { alert: SafetyAlert; trip: Trip }): Promise<void> {
  if (!alert.title) return;
  try {
    await ensureSafetyChannel();
    await Notifications.scheduleNotificationAsync({
      identifier: `voice-safety-${trip.id}-${alert.key}`,
      content: { title: alert.title, body: alert.text, sound: true, data: { tripId: trip.id } },
      trigger: { channelId: SAFETY_CHANNEL_ID },
    });
  } catch (error) {
    Sentry.captureException(error, {
      tags: { feature: 'voiceCommands', action: 'safetyAlertNotify' },
      extra: { tripId: trip.id, key: alert.key },
    });
  }
}
