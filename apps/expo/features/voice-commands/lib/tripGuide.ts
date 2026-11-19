import { observable, syncState, when } from '@legendapp/state';
import { syncObservable } from '@legendapp/state/sync';
import * as Sentry from '@sentry/react-native';
import { preferencesStore } from 'expo-app/features/auth/store/preferences';
import { currentFix, LocatorError } from 'expo-app/features/safety-check-in/lib/locationTracking';
import { persistPlugin } from 'expo-app/lib/persist-plugin';
import { getDefaultSpeedUnit } from 'expo-app/lib/unitDefaults';
import * as Haptics from 'expo-haptics';
import * as Location from 'expo-location';
import * as Speech from 'expo-speech';
import * as TaskManager from 'expo-task-manager';
import i18next from 'i18next';
import { voiceSettingsStore } from '../store/voiceSettings';
import { voiceStore } from '../store/voiceStore';
import { lastSample } from '../utils/recordedTrack';
import {
  ARRIVAL_RADIUS_METERS,
  type GuidanceDestination,
  type GuidancePlan,
  type GuidancePrompt,
  guidancePlan,
  newGuide,
  promptKind,
  type RouteGuide,
  updateGuide,
} from '../utils/routeGuide';
import { type GeoPoint, geoBearing, geoDistance } from '../utils/routeProgress';
import { guidancePromptText } from '../utils/voiceAnswers';
import { askToShowNotification, trackStore, WORST_ACCURACY_METERS } from './trackRecorder';
import { say } from './voiceIO';

/**
 * Spoken guidance to one place on one trip, with the screen off and the phone in a pocket. Keeps
 * its own GPS running through a foreground service, so it works with or without a recording, and
 * is saved on the phone so a relaunch picks it back up.
 */
export const GUIDE_LOCATION_TASK = 'world.packrat.voice-guide';

export interface GuideSession {
  tripId: string;
  tripName: string;
  guide: RouteGuide;
  /** From the user to the destination, as of the latest fix. */
  bearing: number;
  /** What guidance said last, shown on the card. */
  lastPrompt: string | null;
}

export const guideStore = observable<{ session: GuideSession | null }>({ session: null });

syncObservable(guideStore, {
  persist: { plugin: persistPlugin, name: 'voiceGuide' },
});

const guideSyncState = syncState(guideStore);

function isMetric(): boolean {
  return (preferencesStore.speedUnit.peek() ?? getDefaultSpeedUnit()) === 'kmh';
}

/** Whether guidance says this kind of prompt at all. Arriving is always said. */
function allows(prompt: GuidancePrompt): boolean {
  const settings = voiceSettingsStore.peek();
  switch (promptKind(prompt)) {
    case 'turn':
      return settings.guidanceTurns !== false;
    case 'milestone':
      return settings.guidanceMilestones !== false;
    case 'offRoute':
      return settings.guidanceOffRoute !== false;
    case 'arrived':
      return true;
  }
}

// Defined at module scope so a headless relaunch finds the task before any UI mounts.
TaskManager.defineTask<{ locations: Location.LocationObject[] }>(
  GUIDE_LOCATION_TASK,
  async ({ data, error }) => {
    if (error || !data) return; // No fix for a while means no prompts until the sky comes back.
    try {
      await when(guideSyncState.isPersistLoaded);
      const location = data.locations
        .filter((l) => l.coords.accuracy != null && l.coords.accuracy <= WORST_ACCURACY_METERS)
        .at(-1);
      if (location) await follow(location);
    } catch (taskError) {
      Sentry.captureException(taskError, {
        tags: { feature: 'voiceCommands', action: 'followGuidance' },
      });
    }
  },
);

let following = false;

async function follow(location: Location.LocationObject): Promise<void> {
  const session = guideStore.session.peek();
  if (!session || following) return;
  // Never talk over a command in progress or an answer being said. The guide isn't advanced
  // either, so the prompt comes on the next fix.
  if (voiceStore.phase.peek() !== 'idle' && voiceStore.phase.peek() !== 'answering') return;
  following = true;
  try {
    if (await Speech.isSpeakingAsync()) return;
    // Guidance stopped or restarted while that was checked: this fix belongs to nothing now.
    if (guideStore.session.peek()?.guide.plan !== session.guide.plan) return;
    const position = { latitude: location.coords.latitude, longitude: location.coords.longitude };
    const metric = isMetric();
    const { guide, prompts } = updateGuide({
      guide: session.guide,
      position,
      time: location.timestamp,
      metric,
    });
    const text = prompts
      .filter(allows)
      .map((prompt) =>
        guidancePromptText({ prompt, destination: guide.plan.destination.name, metric }),
      )
      .join(' ');
    guideStore.session.set({
      ...session,
      guide,
      bearing: geoBearing({ from: position, to: guide.plan.destination.point }),
      lastPrompt: text || session.lastPrompt,
    });
    if (guide.hasArrived) await stopGuidance();
    if (text) await deliver(text);
  } finally {
    following = false;
  }
}

/** Says something guidance-related now, such as the opening line after Navigate is tapped. */
export async function announce(text: string): Promise<void> {
  guideStore.session.lastPrompt.set(text);
  await deliver(text);
}

async function deliver(text: string): Promise<void> {
  if (voiceSettingsStore.guidanceVibrateOnly.peek()) {
    await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    return;
  }
  await say(text);
}

// ── Start and stop ────────────────────────────────────────────────────────

export class GuideStartError extends Error {
  /** `unavailable`: Android refused the location service, e.g. started with the app in the background. */
  constructor(readonly reason: 'denied' | 'noFix' | 'alreadyThere' | 'unavailable') {
    super(`Guidance couldn't start: ${reason}`);
    this.name = 'GuideStartError';
  }
}

export function isGuiding(tripId: string): boolean {
  return guideStore.session.peek()?.tripId === tripId;
}

/**
 * Starts guidance from where the user is now, and hands back the plan and that position for the
 * opening sentence.
 */
export async function startGuidance({
  tripId,
  tripName,
  destination,
  route,
}: {
  tripId: string;
  tripName: string;
  destination: GuidanceDestination;
  route: readonly GeoPoint[];
}): Promise<{ plan: GuidancePlan; position: GeoPoint }> {
  await when(guideSyncState.isPersistLoaded);
  const position = await currentPosition();
  if (geoDistance({ from: position, to: destination.point }) <= ARRIVAL_RADIUS_METERS) {
    throw new GuideStartError('alreadyThere');
  }
  const plan = guidancePlan({ from: position, to: destination, route });
  // Sets progress for the card; a turn right at the start is in the opening line's place.
  const { guide } = updateGuide({
    guide: newGuide(plan),
    position,
    time: Date.now(),
    metric: isMetric(),
  });
  guideStore.session.set({
    tripId,
    tripName,
    guide,
    bearing: geoBearing({ from: position, to: destination.point }),
    lastPrompt: null,
  });
  Sentry.addBreadcrumb({
    category: 'voiceCommands',
    message: 'Guidance started',
    level: 'info',
    data: { tripId },
  });
  await askToShowNotification();
  try {
    await startUpdates(destination.name);
  } catch {
    // Roll back only this start's session; a newer one may have replaced it meanwhile.
    if (guideStore.session.peek()?.guide.plan === guide.plan) guideStore.session.set(null);
    throw new GuideStartError('unavailable');
  }
  return { plan, position };
}

export async function stopGuidance(): Promise<void> {
  const ended = guideStore.session.peek();
  if (!ended) return;
  guideStore.session.set(null);
  await stopUpdates();
  Sentry.addBreadcrumb({
    category: 'voiceCommands',
    message: 'Guidance stopped',
    level: 'info',
    data: { tripId: ended.tripId },
  });
}

/** At launch: carries on guidance PackRat was closed in the middle of. */
export async function resumeGuidanceIfNeeded(): Promise<void> {
  await when(guideSyncState.isPersistLoaded);
  const session = guideStore.session.peek();
  // A failure is already reported, and this runs again at the next launch.
  if (session) await startUpdates(session.guide.plan.destination.name).catch(() => undefined);
  else await stopUpdates();
}

/** A recorder point this recent is where the user is. */
const FRESH_SAMPLE_MS = 30_000;

/** The recorder's latest point when it's fresh, otherwise a new fix. */
async function currentPosition(): Promise<GeoPoint> {
  const track = trackStore.track.peek();
  const sample = track ? lastSample(track) : null;
  if (sample && Date.now() - sample.time < FRESH_SAMPLE_MS) return sample;
  try {
    return await currentFix({ acceptRecentMs: FRESH_SAMPLE_MS });
  } catch (error) {
    const denied = error instanceof LocatorError && error.reason === 'denied';
    throw new GuideStartError(denied ? 'denied' : 'noFix');
  }
}

async function startUpdates(destination: string): Promise<void> {
  try {
    if (await Location.hasStartedLocationUpdatesAsync(GUIDE_LOCATION_TASK)) return;
    await Location.startLocationUpdatesAsync(GUIDE_LOCATION_TASK, {
      accuracy: Location.Accuracy.BestForNavigation,
      distanceInterval: 5,
      timeInterval: 3_000,
      pausesUpdatesAutomatically: false,
      activityType: Location.ActivityType.Fitness,
      showsBackgroundLocationIndicator: true,
      foregroundService: {
        notificationTitle: i18next.t('voiceCommands.guidance.serviceTitle', { destination }),
        notificationBody: i18next.t('voiceCommands.guidance.serviceBody'),
        killServiceOnDestroy: false,
      },
    });
  } catch (error) {
    Sentry.captureException(error, { tags: { feature: 'voiceCommands', action: 'startGuide' } });
    throw error;
  }
}

async function stopUpdates(): Promise<void> {
  try {
    if (await Location.hasStartedLocationUpdatesAsync(GUIDE_LOCATION_TASK)) {
      await Location.stopLocationUpdatesAsync(GUIDE_LOCATION_TASK);
    }
  } catch (error) {
    Sentry.captureException(error, { tags: { feature: 'voiceCommands', action: 'stopGuide' } });
  }
}
