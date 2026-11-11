import { observable } from '@legendapp/state';
import * as Sentry from '@sentry/react-native';
import { preferencesStore } from 'expo-app/features/auth/store/preferences';
import { getPackItems } from 'expo-app/features/packs/store/packItems';
import { contactSummary } from 'expo-app/features/safety-check-in/lib/copy';
import { currentFix, LocatorError } from 'expo-app/features/safety-check-in/lib/locationTracking';
import {
  endSafetyCheckIn,
  extendSafetyCheckIn,
  loadContacts,
  recordSafetyCheckIn,
  startSafetyCheckIn,
} from 'expo-app/features/safety-check-in/lib/safetyActions';
import { setTripLifecycle } from 'expo-app/features/safety-check-in/lib/tripLifecycle';
import { safetyStore } from 'expo-app/features/safety-check-in/store/safetyCheckIn';
import type { SafetyLocationFix } from 'expo-app/features/safety-check-in/types';
import {
  canBeNotified,
  DEFAULT_GRACE_MINUTES,
  defaultExpectedReturn,
  identifyingGear,
} from 'expo-app/features/safety-check-in/utils/safetyCheckIn';
import { tripConditionsStore } from 'expo-app/features/trips/store/tripReminders';
import type { Trip } from 'expo-app/features/trips/types';
import { t } from 'expo-app/lib/i18n';
import { getDefaultSpeedUnit } from 'expo-app/lib/unitDefaults';
import * as Network from 'expo-network';
import { voiceSettingsStore } from '../store/voiceSettings';
import { routeProgress } from '../utils/routeProgress';
import {
  checkedIn,
  confirmCheckIn,
  confirmExtend,
  confirmFinish,
  confirmNotify,
  confirmSafe,
  dueBackAnswer,
  extended,
  markedSafe,
  newReturnTime,
  notified,
  onRouteAnswer,
  remainingAnswer,
  VoiceAnswers,
  weatherAnswer,
  whereAmIAnswer,
} from '../utils/voiceAnswers';
import {
  parseVoiceCommand,
  parseVoiceConfirmation,
  type VoiceCommand,
} from '../utils/voiceCommand';
import {
  cancelListening,
  hasVoicePermission,
  type ListenMode,
  listen,
  playTone,
  requestVoicePermission,
  say,
  stopListening,
  stopSpeaking,
  VoiceListenError,
} from './voiceIO';

export type VoicePhase =
  | 'idle'
  | 'listening'
  | 'working'
  /** Waiting on a spoken yes or no. */
  | 'confirming'
  | 'answering';

/**
 * What the trip page's voice bar shows: the phase, what PackRat heard, what it's doing about it,
 * then what it said. One command runs at a time, for the trip on screen.
 */
export const voiceStore = observable<{
  phase: VoicePhase;
  heard: string;
  status: string;
  answer: string;
}>({
  phase: 'idle',
  heard: '',
  status: '',
  answer: '',
});

/** Bumped by every new listen or dismiss, so a superseded command stops quietly. */
let generation = 0;

function goIdle() {
  voiceStore.assign({ phase: 'idle', status: '' });
}

// ── Push to talk ──────────────────────────────────────────────────────────

/** The microphone button went down: start listening. */
export async function beginListening(trip: Trip): Promise<void> {
  const phase = voiceStore.phase.peek();
  if (phase !== 'idle' && phase !== 'answering') return;
  // The first press only asks for the microphone. The dialog takes the touch away, so listening
  // starts on the next hold.
  if (!(await hasVoicePermission())) {
    await requestVoicePermission();
    return;
  }
  stopSpeaking();
  const run = ++generation;
  voiceStore.set({ phase: 'listening', heard: '', status: '', answer: '' });
  await playTone('start');
  if (run !== generation) return;
  // Let go during the tone: nothing was said.
  if (voiceStore.phase.peek() !== 'listening') return goIdle();
  try {
    const transcript = await listenFor('untilStopped');
    if (run !== generation) return;
    await handleTranscript({ transcript, trip, run });
  } catch (error) {
    if (run !== generation) return;
    await respond({ text: listenErrorText(error), run });
  }
}

/**
 * The microphone button came up: stop listening and act on what was heard. The bar moves on at
 * once, so the wait for the recogniser's last words doesn't look like nothing happened.
 */
export function endListening(): void {
  if (voiceStore.phase.peek() !== 'listening') return;
  void playTone('end');
  voiceStore.assign({ phase: 'working', status: t('voiceCommands.status.working') });
  stopListening();
}

/** The banner was closed, or the trip page went away. */
export function dismissVoice(): void {
  generation++;
  cancelListening();
  stopSpeaking();
  voiceStore.set({ phase: 'idle', heard: '', status: '', answer: '' });
}

function listenFor(mode: ListenMode): Promise<string> {
  return listen({ mode, onPartial: (text) => voiceStore.heard.set(text) });
}

function listenErrorText(error: unknown): string {
  return error instanceof VoiceListenError ? error.spoken : VoiceAnswers.listenFailed;
}

// ── Commands ──────────────────────────────────────────────────────────────

async function handleTranscript({
  transcript,
  trip,
  run,
}: {
  transcript: string;
  trip: Trip;
  run: number;
}): Promise<void> {
  voiceStore.heard.set(transcript);
  if (!transcript.trim()) return goIdle();
  const command = parseVoiceCommand(transcript);
  if (!command || !STAGE_ONE_COMMANDS.has(command.kind)) {
    return respond({ text: VoiceAnswers.notHeard, run });
  }
  Sentry.addBreadcrumb({
    category: 'voiceCommands',
    message: 'Voice command',
    level: 'info',
    data: { command: command.kind, tripId: trip.id },
  });
  voiceStore.assign({ phase: 'working', status: workingStatus(command) });
  try {
    await perform({ command, trip, run });
  } catch (error) {
    Sentry.captureException(error, {
      tags: { feature: 'voiceCommands', action: command.kind },
      extra: { tripId: trip.id },
    });
    await respond({ text: VoiceAnswers.listenFailed, run });
  }
}

/** What the bar says while a command runs; finding the phone's position is the slow part. */
function workingStatus(command: VoiceCommand): string {
  return LOCATING_COMMANDS.has(command.kind)
    ? t('voiceCommands.status.locating')
    : t('voiceCommands.status.working');
}

const LOCATING_COMMANDS: ReadonlySet<VoiceCommand['kind']> = new Set([
  'checkIn',
  'whereAmI',
  'howFarToGo',
  'amIOnRoute',
]);

/** Tracking, waypoints and guidance arrive with the recorder and the guide. */
const STAGE_ONE_COMMANDS: ReadonlySet<VoiceCommand['kind']> = new Set([
  'startTrip',
  'checkIn',
  'imSafe',
  'extendBy',
  'extendUntil',
  'whereAmI',
  'howFarToGo',
  'amIOnRoute',
  'whenAmIDue',
  'weather',
]);

function isMetric(): boolean {
  return (preferencesStore.speedUnit.peek() ?? getDefaultSpeedUnit()) === 'kmh';
}

async function isOnline(): Promise<boolean> {
  try {
    const state = await Network.getNetworkStateAsync();
    return Boolean(state.isConnected && state.isInternetReachable !== false);
  } catch {
    return false;
  }
}

async function perform({
  command,
  trip,
  run,
}: {
  command: VoiceCommand;
  trip: Trip;
  run: number;
}): Promise<void> {
  const checkIn = safetyStore.active.peek()[trip.id];
  const contacts = checkIn ? contactSummary({ names: checkIn.contactNames, t }) : '';
  const status = trip.status ?? 'planned';
  const now = new Date();
  const metric = isMetric();
  const answer = (text: string) => respond({ text, run });
  const ask = (question: string) => confirm({ question, run });

  switch (command.kind) {
    case 'startTrip': {
      if (status !== 'planned') return answer(VoiceAnswers.alreadyStarted);
      setTripLifecycle({ tripId: trip.id, status: 'in_progress' });
      // Contacts load when a safety screen opens; by voice, none may have been yet.
      if (safetyStore.contacts.peek().length === 0) await loadContacts();
      const reachable = safetyStore.contacts.peek().filter(canBeNotified);
      const contact = reachable.find((c) => c.isDefault) ?? reachable[0];
      if (!contact) return answer(VoiceAnswers.tripStarted);
      const expectedReturnAt = defaultExpectedReturn({ trip, now });
      if (
        !(await ask(
          confirmNotify({ contact: contact.name, expectedReturn: expectedReturnAt, now }),
        ))
      ) {
        return answer(VoiceAnswers.tripStarted);
      }
      startSafetyCheckIn({
        tripId: trip.id,
        tripName: trip.name,
        contacts: [contact],
        expectedReturnAt,
        graceMinutes: DEFAULT_GRACE_MINUTES,
        gear: identifyingGear(trip.packId ? (getPackItems(trip.packId) ?? []) : []),
        trackingEnabled: false,
      });
      return answer(notified({ contact: contact.name, online: await isOnline() }));
    }

    case 'checkIn': {
      if (!checkIn) return answer(VoiceAnswers.noContactsTold);
      const fix = await locate();
      if (!fix.ok) return answer(fix.answer);
      if (!(await ask(confirmCheckIn({ contacts, placeName: fix.fix.placeName })))) {
        return answer(VoiceAnswers.cancelled);
      }
      recordSafetyCheckIn({ tripId: trip.id, fix: fix.fix, note: '' });
      return answer(checkedIn(await isOnline()));
    }

    case 'imSafe': {
      if (checkIn) {
        if (!(await ask(confirmSafe(trip.name)))) return answer(VoiceAnswers.cancelled);
        endSafetyCheckIn({ tripId: trip.id, outcome: 'safe' });
        setTripLifecycle({ tripId: trip.id, status: 'complete' });
        return answer(markedSafe(await isOnline()));
      }
      if (status !== 'in_progress') return answer(VoiceAnswers.noTrip);
      if (!(await ask(confirmFinish(trip.name)))) return answer(VoiceAnswers.cancelled);
      setTripLifecycle({ tripId: trip.id, status: 'complete' });
      return answer(VoiceAnswers.finished);
    }

    case 'extendBy':
    case 'extendUntil': {
      if (!checkIn) return answer(VoiceAnswers.noCheckIn);
      const to = newReturnTime({ command, current: new Date(checkIn.expectedReturnAt), now });
      if (!(await ask(confirmExtend({ to, contacts, now })))) return answer(VoiceAnswers.cancelled);
      extendSafetyCheckIn({ tripId: trip.id, to });
      return answer(extended({ to, online: await isOnline(), now }));
    }

    case 'whereAmI': {
      const fix = await locate();
      if (!fix.ok) return answer(fix.answer);
      const route = trip.plannedRoute ?? [];
      return answer(
        whereAmIAnswer({
          placeName: fix.fix.placeName,
          progress: routeProgress({ position: fix.fix, route }),
          latitude: fix.fix.latitude,
          longitude: fix.fix.longitude,
          altitudeMeters: fix.fix.altitude,
          metric,
        }),
      );
    }

    case 'howFarToGo':
    case 'amIOnRoute': {
      const route = trip.plannedRoute ?? [];
      if (route.length < 2) return answer(VoiceAnswers.noRoute);
      const fix = await locate();
      if (!fix.ok) return answer(fix.answer);
      const progress = routeProgress({ position: fix.fix, route });
      if (!progress) return answer(VoiceAnswers.noRoute);
      return answer(
        command.kind === 'howFarToGo'
          ? remainingAnswer({ progress, metric })
          : onRouteAnswer({ progress, metric }),
      );
    }

    case 'whenAmIDue': {
      if (!checkIn) return answer(VoiceAnswers.noCheckIn);
      return answer(
        dueBackAnswer({
          expectedReturn: new Date(checkIn.expectedReturnAt),
          graceMinutes: checkIn.graceMinutes,
          now,
        }),
      );
    }

    case 'weather': {
      const conditions = tripConditionsStore.peek()[trip.id];
      if (!conditions) return answer(VoiceAnswers.noForecast);
      return answer(weatherAnswer({ conditions, metric, now }));
    }

    default:
      return answer(VoiceAnswers.notHeard);
  }
}

/** A fix this recent answers straight away instead of waiting on the GPS. */
const RECENT_FIX_MS = 60_000;

async function locate(): Promise<
  { ok: true; fix: SafetyLocationFix } | { ok: false; answer: string }
> {
  try {
    return { ok: true, fix: await currentFix({ acceptRecentMs: RECENT_FIX_MS }) };
  } catch (error) {
    const denied = error instanceof LocatorError && error.reason === 'denied';
    return { ok: false, answer: denied ? VoiceAnswers.locationDenied : VoiceAnswers.noFix };
  }
}

// ── Speaking and confirming ───────────────────────────────────────────────

/**
 * Asks a yes or no question and listens hands-free for the answer. Anything but a clear yes,
 * including silence, is a no.
 */
async function confirm({ question, run }: { question: string; run: number }): Promise<boolean> {
  voiceStore.set({ phase: 'confirming', heard: '', status: '', answer: question });
  if (voiceSettingsStore.spokenAnswers.peek()) await say(question);
  if (run !== generation) return false;
  let reply = '';
  try {
    reply = await listenFor('untilSilence');
  } catch {
    // A failed listen is a no, like silence.
  }
  if (run !== generation) return false;
  const yes = parseVoiceConfirmation(reply) === 'yes';
  voiceStore.assign({
    phase: 'working',
    heard: reply,
    status: t('voiceCommands.status.working'),
    answer: '',
  });
  return yes;
}

async function respond({ text, run }: { text: string; run: number }): Promise<void> {
  if (run !== generation) return;
  voiceStore.assign({ phase: 'answering', status: '', answer: text });
  if (voiceSettingsStore.spokenAnswers.peek()) await say(text);
}
