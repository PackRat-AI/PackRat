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
import { delay } from 'expo-app/modules/wake-word';
import * as Network from 'expo-network';
import { voiceSettingsStore } from '../store/voiceSettings';
import { voiceStore } from '../store/voiceStore';
import { lastSample } from '../utils/recordedTrack';
import { destinationOptions, resolveDestination } from '../utils/routeGuide';
import { routeProgress } from '../utils/routeProgress';
import {
  alreadyThere,
  checkedIn,
  confirmCheckIn,
  confirmExtend,
  confirmFinish,
  confirmNotify,
  confirmSafe,
  dueBackAnswer,
  extended,
  guidanceRemaining,
  markedSafe,
  navigatingAnswer,
  navigatingOtherTrip,
  navigationStopped,
  newReturnTime,
  notified,
  onRouteAnswer,
  remainingAnswer,
  trackingOtherTrip,
  trackingStopped,
  trackSoFar,
  unknownDestination,
  VoiceAnswers,
  waypointMarked,
  weatherAnswer,
  whereAmIAnswer,
} from '../utils/voiceAnswers';
import {
  parseVoiceCommand,
  parseVoiceConfirmation,
  type VoiceCommand,
} from '../utils/voiceCommand';
import {
  pauseRecording,
  resumeRecording,
  startRecording,
  stopRecording,
  TrackStartError,
  trackStore,
  WORST_ACCURACY_METERS,
} from './trackRecorder';
import { GuideStartError, guideStore, isGuiding, startGuidance, stopGuidance } from './tripGuide';
import { addWaypoint, saveRecording } from './tripLogEdits';
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
import { resumeWakeWord } from './wakeWord';
import { waypointAt } from './waypointAt';

/** Bumped by every new listen or dismiss, so a superseded command stops quietly. */
let generation = 0;

function goIdle() {
  voiceStore.assign({ phase: 'idle', status: '' });
  resumeWakeWord();
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

// ── "Hey PackRat" ─────────────────────────────────────────────────────────

/**
 * The wake phrase was heard, perhaps with the phone locked: listen hands-free for the command.
 * While a command is already running the wake listener stays paused, and that command resumes it
 * when it's done.
 */
export async function handleWake(trip: Trip): Promise<void> {
  const phase = voiceStore.phase.peek();
  if (phase !== 'idle' && phase !== 'answering') return;
  Sentry.addBreadcrumb({
    category: 'voiceCommands',
    message: 'Wake phrase heard',
    level: 'info',
    data: { tripId: trip.id },
  });
  stopSpeaking();
  const run = ++generation;
  voiceStore.set({ phase: 'listening', heard: '', status: '', answer: '' });
  await playTone('start');
  if (run !== generation) return;
  try {
    const transcript = await listenFor('untilSilence');
    if (run !== generation) return;
    void playTone('end');
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
  resumeWakeWord();
}

function listenFor(mode: ListenMode): Promise<string> {
  return listen({ mode, onPartial: (text) => voiceStore.heard.set(text) });
}

function listenErrorText(error: unknown): string {
  return error instanceof VoiceListenError ? error.spoken : VoiceAnswers.listenFailed;
}

// ── The phone's assistant ─────────────────────────────────────────────────

export interface AssistantResult {
  answer: string;
  /** The answer is a yes-or-no question; the assistant asks it and calls again on a yes. */
  needsConfirmation: boolean;
}

/**
 * A command from Gemini or another assistant, perhaps with PackRat closed. The assistant says the
 * answer itself, so nothing is spoken or shown here. A command that tells other people something
 * comes back as a question, and runs when the assistant calls again with the user's yes.
 */
export async function runForAssistant({
  request,
  confirmed,
  trip,
}: {
  request: string;
  confirmed: boolean;
  trip: Trip | null;
}): Promise<AssistantResult> {
  const reply = (answer: string): AssistantResult => ({ answer, needsConfirmation: false });
  if (voiceSettingsStore.enabled.peek() === false) return reply(VoiceAnswers.voiceOff);
  const phase = voiceStore.phase.peek();
  if (phase !== 'idle' && phase !== 'answering') return reply(VoiceAnswers.busy);
  const command = parseVoiceCommand(request);
  if (!command) return reply(VoiceAnswers.notHeard);
  if (!trip) return reply(VoiceAnswers.noTrip);
  Sentry.addBreadcrumb({
    category: 'voiceCommands',
    message: 'Assistant command',
    level: 'info',
    data: { command: command.kind, tripId: trip.id, confirmed },
  });

  let said = '';
  let question: string | null = null;
  await perform({
    command,
    trip,
    answer: async (text) => {
      said = text;
    },
    ask: async (text) => {
      if (confirmed) return true;
      question = text;
      return false;
    },
    confirmedByAssistant: confirmed,
  });
  return question ? { answer: question, needsConfirmation: true } : reply(said);
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
  if (!command) {
    return respond({ text: VoiceAnswers.notHeard, run });
  }
  Sentry.addBreadcrumb({
    category: 'voiceCommands',
    message: 'Voice command',
    level: 'info',
    data: { command: command.kind, tripId: trip.id },
  });
  voiceStore.assign({ phase: 'working', status: workingStatus(command) });
  if (LOCATING_COMMANDS.has(command.kind)) void sayWhenSlow(run);
  try {
    await perform({
      command,
      trip,
      answer: (text) => respond({ text, run }),
      ask: (question) => confirm({ question, run }),
    });
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
  'markWaypoint',
  'note',
  'navigate',
]);

/** An answer within this long needs no word that PackRat is on it. */
const SLOW_ANSWER_MS = 1_200;

/**
 * With the phone locked the bar can't be seen, so a slow fix says once what PackRat is doing.
 * The native delay keeps time while locked, which JS timers don't.
 */
async function sayWhenSlow(run: number): Promise<void> {
  await delay(SLOW_ANSWER_MS);
  if (run !== generation || voiceStore.phase.peek() !== 'working') return;
  if (voiceSettingsStore.spokenAnswers.peek()) await say(t('voiceCommands.status.locating'));
}

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
  answer,
  ask,
  confirmedByAssistant = false,
}: {
  command: VoiceCommand;
  trip: Trip;
  answer: (text: string) => Promise<void>;
  /** Resolves true on a clear yes. */
  ask: (question: string) => Promise<boolean>;
  /** The assistant's second call, after the user said yes to the question its first call asked. */
  confirmedByAssistant?: boolean;
}): Promise<void> {
  const checkIn = safetyStore.active.peek()[trip.id];
  const contacts = checkIn ? contactSummary({ names: checkIn.contactNames, t }) : '';
  const status = trip.status ?? 'planned';
  const now = new Date();
  const metric = isMetric();

  switch (command.kind) {
    case 'startTrip': {
      // The assistant's first call started the trip and asked about telling a contact; its
      // second call carries the yes.
      const resumingYes = confirmedByAssistant && status === 'in_progress' && !checkIn;
      if (status !== 'planned' && !resumingYes) return answer(VoiceAnswers.alreadyStarted);
      if (status === 'planned') setTripLifecycle({ tripId: trip.id, status: 'in_progress' });
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
      const session = guideStore.session.peek();
      if (session?.tripId === trip.id) {
        if (command.kind === 'howFarToGo') {
          return answer(
            guidanceRemaining({ guide: session.guide, bearing: session.bearing, metric }),
          );
        }
        if (session.guide.progress) {
          return answer(onRouteAnswer({ progress: session.guide.progress, metric }));
        }
      }
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

    case 'startTracking':
    case 'pauseTracking':
    case 'resumeTracking':
    case 'stopTracking':
    case 'trackSoFar':
      return performTracking({ command, trip, answer, metric });

    case 'navigate':
      return navigate({ spoken: command.to, trip, answer, metric });

    case 'stopNavigating': {
      if (!isGuiding(trip.id)) return answer(VoiceAnswers.notNavigating);
      await stopGuidance();
      return answer(navigationStopped(trackStore.track.peek()?.tripId === trip.id));
    }

    case 'markWaypoint':
    case 'note': {
      if (command.kind === 'note' && !command.text.trim()) return answer(VoiceAnswers.noteEmpty);
      const fix = await waypointFix();
      if (!fix.ok) return answer(fix.answer);
      const waypoint = waypointAt({
        fix: fix.fix,
        name: command.kind === 'markWaypoint' ? command.name : null,
        note: command.kind === 'note' ? command.text : null,
      });
      if (!addWaypoint({ tripId: trip.id, waypoint })) return answer(VoiceAnswers.waypointLimit);
      return answer(
        command.kind === 'note' ? VoiceAnswers.noteSaved : waypointMarked(waypoint.name),
      );
    }

    default:
      return answer(VoiceAnswers.notHeard);
  }
}

async function navigate({
  spoken,
  trip,
  answer,
  metric,
}: {
  spoken: string;
  trip: Trip;
  answer: (text: string) => Promise<void>;
  metric: boolean;
}): Promise<void> {
  if (trip.status === 'complete') return answer(VoiceAnswers.tripEnded);
  const other = guideStore.session.peek();
  if (other && other.tripId !== trip.id) return answer(navigatingOtherTrip(other.tripName));
  const waypoints = trip.log?.waypoints ?? [];
  const route = trip.plannedRoute ?? [];
  const destination = resolveDestination({ spoken, waypoints, route });
  if (!destination) {
    const options = destinationOptions({ waypoints, route });
    return answer(
      options.length === 0 ? VoiceAnswers.noDestinations : unknownDestination({ spoken, options }),
    );
  }
  try {
    const { plan, position } = await startGuidance({
      tripId: trip.id,
      tripName: trip.name,
      destination,
      route,
    });
    const text = navigatingAnswer({ plan, from: position, metric });
    guideStore.session.lastPrompt.set(text);
    return answer(text);
  } catch (error) {
    if (error instanceof GuideStartError && error.reason === 'denied') {
      return answer(VoiceAnswers.locationDenied);
    }
    if (error instanceof GuideStartError && error.reason === 'alreadyThere') {
      return answer(alreadyThere(destination.name));
    }
    if (error instanceof GuideStartError && error.reason === 'unavailable') {
      return answer(VoiceAnswers.guidanceNotStarted);
    }
    return answer(VoiceAnswers.noFix);
  }
}

async function performTracking({
  command,
  trip,
  answer,
  metric,
}: {
  command: VoiceCommand;
  trip: Trip;
  answer: (text: string) => Promise<void>;
  metric: boolean;
}): Promise<void> {
  const track = trackStore.track.peek();
  if (track && track.tripId !== trip.id) return answer(trackingOtherTrip(track.tripName));
  switch (command.kind) {
    case 'startTracking': {
      if (track) return answer(VoiceAnswers.alreadyTracking);
      const status = trip.status ?? 'planned';
      if (status === 'complete') return answer(VoiceAnswers.tripEnded);
      try {
        await startRecording({ tripId: trip.id, tripName: trip.name });
      } catch (error) {
        return answer(
          error instanceof TrackStartError && error.reason === 'unavailable'
            ? VoiceAnswers.trackingNotStarted
            : VoiceAnswers.locationDenied,
        );
      }
      // Tracking a trip that hasn't started starts it.
      if (status === 'planned') {
        setTripLifecycle({ tripId: trip.id, status: 'in_progress' });
        return answer(VoiceAnswers.tripStartedTracking);
      }
      return answer(VoiceAnswers.trackingStarted);
    }
    case 'pauseTracking':
      if (!track) return answer(VoiceAnswers.notTracking);
      if (track.isPaused) return answer(VoiceAnswers.alreadyPaused);
      await pauseRecording();
      return answer(VoiceAnswers.trackingPaused);
    case 'resumeTracking':
      if (!track) return answer(VoiceAnswers.notTracking);
      if (!track.isPaused) return answer(VoiceAnswers.notPaused);
      try {
        await resumeRecording();
      } catch {
        return answer(VoiceAnswers.trackingNotStarted);
      }
      return answer(VoiceAnswers.trackingResumed);
    case 'stopTracking': {
      const finished = await stopRecording();
      if (!finished) return answer(VoiceAnswers.notTracking);
      if (!saveRecording(finished)) return answer(VoiceAnswers.trackingNotSaved);
      return answer(trackingStopped({ track: finished, metric }));
    }
    case 'trackSoFar':
      if (!track) return answer(VoiceAnswers.notTracking);
      return answer(trackSoFar({ track, metric }));
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

/** A recorder point this recent is where the user is, so marking while tracking is instant. */
const FRESH_SAMPLE_MS = 30_000;

/** The recorder's latest point when it's fresh; otherwise a new fix. */
async function waypointFix(): ReturnType<typeof locate> {
  const track = trackStore.track.peek();
  const sample = track ? lastSample(track) : null;
  if (sample && Date.now() - sample.time < FRESH_SAMPLE_MS) {
    return {
      ok: true,
      fix: {
        latitude: sample.latitude,
        longitude: sample.longitude,
        accuracy: WORST_ACCURACY_METERS,
        recordedAt: new Date(sample.time),
        altitude: sample.altitude,
      },
    };
  }
  return locate();
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
  if (run === generation) resumeWakeWord();
}
