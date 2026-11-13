import type { TripConditions } from 'expo-app/features/trips/utils/tripConditions';
import type { RecordedTrack } from './recordedTrack';
import { trackLogRoute } from './recordedTrack';
import {
  type GuidancePlan,
  type GuidancePrompt,
  type GuidanceTurn,
  maneuver,
  type RouteGuide,
} from './routeGuide';
import {
  compassName,
  type GeoPoint,
  geoBearing,
  isOnRoute,
  type RouteProgress,
} from './routeProgress';
import type { VoiceCommand } from './voiceCommand';

/**
 * The sentences PackRat says back. Kept apart from the controller so every answer can be checked
 * without a microphone or a location fix.
 */
export const VoiceAnswers = Object.freeze({
  notHeard:
    "Sorry, I didn't catch that. You can say start tracking, mark waypoint, note, how far have I gone, navigate to, check in, where am I, how far to go, am I on route, when am I due back, add an hour, weather, or I'm safe.",
  noTrip: "There's no trip in progress.",
  noRoute: "This trip doesn't have a planned route.",
  noCheckIn:
    "This trip doesn't have a return time. Notify your contacts from the trip page to set one.",
  noFix: "I couldn't get your location. Try again with a clear view of the sky.",
  locationDenied:
    'PackRat needs your location for that. Allow it in Settings, under Apps, PackRat, then Permissions.',
  microphoneDenied:
    'PackRat needs the microphone for voice commands. Allow it in Settings, under Apps, PackRat, then Permissions.',
  listenFailed: "PackRat couldn't listen just now. Try again.",
  cancelled: "OK, I won't send it.",
  queued: "Saved. It'll send when you have signal.",
  noForecast: "There's no forecast saved for this trip.",
  alreadyStarted: 'Your trip has already started.',
  tripStarted: 'Trip started. Have a good one.',
  noContactsTold:
    "No one's been told about this trip yet. Notify your contacts from the trip page first.",
  finished: 'Trip ended. Welcome back.',
  tripEnded: 'This trip has ended.',
  trackingStarted: "Tracking started. I'll keep recording with the screen off.",
  tripStartedTracking: "Trip started, and tracking. I'll keep recording with the screen off.",
  alreadyTracking: "You're already tracking.",
  notTracking: "You're not tracking. Say start tracking to begin.",
  trackingPaused: 'Tracking paused. Say resume tracking when you set off again.',
  alreadyPaused: 'Tracking is already paused.',
  trackingResumed: 'Tracking resumed.',
  notPaused: "Tracking isn't paused.",
  waypointLimit:
    'This trip has 500 waypoints already. Delete one on the trip page to mark another.',
  noteEmpty: 'Say note, then what you want to save.',
  noteSaved: 'Note saved here.',
  noDestinations:
    "There's nowhere to navigate to yet. Mark a waypoint or add a planned route first.",
  notNavigating: "You're not navigating anywhere.",
  backOnRoute: "You're back on route.",
});

// ── Distances ─────────────────────────────────────────────────────────────

const METRES_PER_MILE = 1_609.344;
const FEET_PER_METRE = 3.28084;

/** "half a mile", "3.2 miles", "300 feet", "800 metres", "1.4 kilometres". */
export function spokenDistance({ meters, metric }: { meters: number; metric: boolean }): string {
  if (metric) {
    if (meters < 950) return `${Math.max(10, Math.round(meters / 10) * 10)} metres`;
    return `${oneDecimal(meters / 1_000)} kilometres`;
  }
  const miles = meters / METRES_PER_MILE;
  if (miles < 0.2) {
    const feet = Math.max(50, Math.round((meters * FEET_PER_METRE) / 50) * 50);
    return `${grouped(feet)} feet`;
  }
  if (miles < 0.35) return 'a quarter of a mile';
  if (miles < 0.65) return 'half a mile';
  if (miles < 0.9) return 'three quarters of a mile';
  const value = oneDecimal(miles);
  return value === '1' ? '1 mile' : `${value} miles`;
}

export function spokenHeight({ meters, metric }: { meters: number; metric: boolean }): string {
  if (metric) return `${grouped(Math.round(meters / 10) * 10)} metres`;
  return `${grouped(Math.round((meters * FEET_PER_METRE) / 10) * 10)} feet`;
}

function oneDecimal(value: number): string {
  const rounded = Math.round(value * 10) / 10;
  return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1);
}

function grouped(value: number): string {
  return String(value).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

function capitalizeFirst(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

// ── Answers ───────────────────────────────────────────────────────────────

/**
 * A place name when the phone can look one up, otherwise progress along the route, otherwise the
 * coordinates, which are what a rescuer needs.
 */
export function whereAmIAnswer({
  placeName,
  progress,
  latitude,
  longitude,
  altitudeMeters,
  metric,
}: {
  placeName: string | null | undefined;
  progress: RouteProgress | null;
  latitude: number;
  longitude: number;
  altitudeMeters: number | null | undefined;
  metric: boolean;
}): string {
  let sentence: string;
  if (placeName) {
    sentence = `You're near ${placeName}`;
  } else if (progress && isOnRoute(progress)) {
    sentence = `You're ${spokenDistance({ meters: progress.alongMeters, metric })} along your route, with ${spokenDistance({ meters: progress.remainingMeters, metric })} to go`;
  } else {
    sentence = `You're at ${coordinate({ value: latitude, positive: 'north', negative: 'south' })}, ${coordinate({ value: longitude, positive: 'east', negative: 'west' })}`;
  }
  if (altitudeMeters != null)
    sentence += `, at ${spokenHeight({ meters: altitudeMeters, metric })}`;
  return `${sentence}.`;
}

function coordinate({
  value,
  positive,
  negative,
}: {
  value: number;
  positive: string;
  negative: string;
}): string {
  return `${Math.abs(value).toFixed(3)} degrees ${value >= 0 ? positive : negative}`;
}

export function remainingAnswer({
  progress,
  metric,
}: {
  progress: RouteProgress;
  metric: boolean;
}): string {
  if (progress.remainingMeters < 50) return "You're at the end of your route.";
  let sentence = `${capitalizeFirst(spokenDistance({ meters: progress.remainingMeters, metric }))} to go to the end of your route.`;
  if (!isOnRoute(progress)) {
    sentence += ` You're ${spokenDistance({ meters: progress.offRouteMeters, metric })} off it.`;
  }
  return sentence;
}

export function onRouteAnswer({
  progress,
  metric,
}: {
  progress: RouteProgress;
  metric: boolean;
}): string {
  if (isOnRoute(progress)) return "Yes, you're on your route.";
  const toward = compassName(progress.bearingToRoute);
  const away = compassName((progress.bearingToRoute + 180) % 360);
  return `You're about ${spokenDistance({ meters: progress.offRouteMeters, metric })} ${away} of your route. Head ${toward} to rejoin it.`;
}

export function dueBackAnswer({
  expectedReturn,
  graceMinutes,
  now,
  clock,
}: {
  expectedReturn: Date;
  graceMinutes: number;
  now: Date;
  clock?: SpeechClock;
}): string {
  const alertAt = new Date(expectedReturn.getTime() + graceMinutes * 60_000);
  const when = spokenTime({ date: expectedReturn, now, clock });
  if (alertAt <= now) {
    return `You were due back ${when}. Your contacts have been sent an overdue alert.`;
  }
  if (expectedReturn <= now) {
    return `You were due back ${when}. Your contacts get an overdue alert in ${spokenDuration(alertAt.getTime() - now.getTime())}.`;
  }
  return `You're due back ${when}. That's ${spokenDuration(expectedReturn.getTime() - now.getTime())} from now.`;
}

// ── Confirmations ─────────────────────────────────────────────────────────

export function confirmCheckIn({
  contacts,
  placeName,
}: {
  contacts: string;
  placeName: string | null | undefined;
}): string {
  return `Checking in with ${contacts}${placeName ? ` near ${placeName}` : ''}. Send it?`;
}

export function confirmSafe(tripName: string): string {
  return `Mark yourself safe and end ${tripName}?`;
}

export function confirmFinish(tripName: string): string {
  return `End ${tripName}?`;
}

export function confirmExtend({
  to,
  contacts,
  now,
  clock,
}: {
  to: Date;
  contacts: string;
  now: Date;
  clock?: SpeechClock;
}): string {
  // "to 8 PM" and "to tomorrow at 9 AM", never "to at 8 PM".
  const when = spokenTime({ date: to, now, clock }).replace(LEADING_AT, '');
  return `Change your return to ${when} and tell ${contacts}?`;
}

export function confirmNotify({
  contact,
  expectedReturn,
  now,
  clock,
}: {
  contact: string;
  expectedReturn: Date;
  now: Date;
  clock?: SpeechClock;
}): string {
  return `Trip started. Tell ${contact} you're due back ${spokenTime({ date: expectedReturn, now, clock })}?`;
}

export function checkedIn(online: boolean): string {
  return online ? 'Checked in.' : VoiceAnswers.queued;
}

export function markedSafe(online: boolean): string {
  return online
    ? "Welcome back. Your contacts have been told you're safe."
    : "You're marked safe. Your contacts will be told when you have signal.";
}

export function extended({
  to,
  online,
  now,
  clock,
}: {
  to: Date;
  online: boolean;
  now: Date;
  clock?: SpeechClock;
}): string {
  const base = `Your return is now ${spokenTime({ date: to, now, clock })}.`;
  return online ? base : `${base} ${VoiceAnswers.queued}`;
}

export function notified({ contact, online }: { contact: string; online: boolean }): string {
  return online ? `${capitalizeFirst(contact)} has your plan.` : VoiceAnswers.queued;
}

/** Snow above this chance is worth saying over rain; matches the readiness summary. */
const SNOW_CHANCE = 30;

export function weatherAnswer({
  conditions,
  metric,
  now,
}: {
  conditions: TripConditions;
  metric: boolean;
  now: Date;
}): string {
  const low = Math.round(metric ? conditions.lowC : conditions.lowF);
  const high = Math.round(metric ? conditions.highC : conditions.highF);
  let sentence = conditions.conditionText ? `${capitalizeFirst(conditions.conditionText)}. ` : '';
  sentence += `Between ${low} and ${high} degrees.`;
  if (conditions.maxChanceOfSnow >= SNOW_CHANCE) {
    sentence += ` ${conditions.maxChanceOfSnow} percent chance of snow.`;
  } else if (conditions.maxChanceOfRain >= 20) {
    sentence += ` ${conditions.maxChanceOfRain} percent chance of rain.`;
  }
  const [alert] = conditions.alerts;
  if (alert) sentence += ` Alert: ${alert.event}.`;
  const age = now.getTime() - conditions.fetchedAt;
  if (age > 3 * 3_600_000) sentence += ` This forecast is from ${spokenDuration(age)} ago.`;
  return sentence;
}

// ── Return time ───────────────────────────────────────────────────────────

/** The return time a command asks for. A time of day already past today means tomorrow. */
export function newReturnTime({
  command,
  current,
  now,
}: {
  command: Extract<VoiceCommand, { kind: 'extendBy' | 'extendUntil' }>;
  current: Date;
  now: Date;
}): Date {
  if (command.kind === 'extendBy') {
    return new Date(Math.max(current.getTime(), now.getTime()) + command.minutes * 60_000);
  }
  const today = new Date(now);
  today.setHours(command.hour, command.minute, 0, 0);
  if (today > now) return today;
  today.setDate(today.getDate() + 1);
  return today;
}

const LEADING_AT = /^at /;
/** "19:00" not already followed by AM or PM. */
const CLOCK_TIME = /\b([01]?\d|2[0-3]):([0-5]\d)\b(?!\s?[AP]M)/g;

// ── Time ──────────────────────────────────────────────────────────────────

/** The phone's locale and time zone, passed in by tests. */
export interface SpeechClock {
  locale?: string;
  timeZone?: string;
}

function dayKey(date: Date, timeZone: string | undefined): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone, dateStyle: 'short' }).format(date);
}

/** "at 7 PM", "at 7:30 PM", "tomorrow at 9 AM", "Sunday at 19:00". */
export function spokenTime({
  date,
  now,
  clock = {},
}: {
  date: Date;
  now: Date;
  clock?: SpeechClock;
}): string {
  const { locale, timeZone } = clock;
  const { hourCycle } = new Intl.DateTimeFormat(locale, {
    hour: 'numeric',
    timeZone,
  }).resolvedOptions();
  // "7 PM" works on a 12-hour clock; a 24-hour clock needs "19:00".
  const twelveHour = hourCycle !== 'h23' && hourCycle !== 'h24';
  const minute = Number(
    new Intl.DateTimeFormat('en-US', { minute: 'numeric', timeZone }).format(date),
  );
  const options: Intl.DateTimeFormatOptions = twelveHour
    ? { hour: 'numeric', minute: minute === 0 ? undefined : '2-digit', hour12: true, timeZone }
    : { hour: '2-digit', minute: '2-digit', hour12: false, timeZone };
  // ICU puts a narrow no-break space before AM/PM; a plain space reads the same aloud.
  const time = new Intl.DateTimeFormat(locale, options)
    .format(date)
    .replace(/[  ]/g, ' ')
    .replace(/\b(am|pm)\b/gi, (m) => m.toUpperCase());
  if (dayKey(date, timeZone) === dayKey(now, timeZone)) return `at ${time}`;
  if (dayKey(date, timeZone) === dayKey(new Date(now.getTime() + 86_400_000), timeZone)) {
    return `tomorrow at ${time}`;
  }
  const day = new Intl.DateTimeFormat(locale, { weekday: 'long', timeZone }).format(date);
  return `${day} at ${time}`;
}

/**
 * The banner shows times on the phone's own clock, but the voice reads "19:00" as "nineteen
 * hundred hours", so spoken text says "7 PM".
 */
export function speakable(text: string): string {
  return text.replace(CLOCK_TIME, (_match, ...groups: string[]) => {
    const [h = '0', m = '00'] = groups;
    const hours = Number(h);
    const minutes = Number(m);
    const hour = hours % 12 === 0 ? 12 : hours % 12;
    const spoken = minutes === 0 ? `${hour}` : `${hour}:${m}`;
    return `${spoken} ${hours < 12 ? 'AM' : 'PM'}`;
  });
}

/** "2 hours", "1 hour 20 minutes", "45 minutes". */
export function spokenDuration(milliseconds: number): string {
  const total = Math.max(1, Math.round(milliseconds / 60_000));
  const hours = Math.floor(total / 60);
  const minutes = total % 60;
  const h = hours === 1 ? '1 hour' : `${hours} hours`;
  const m = minutes === 1 ? '1 minute' : `${minutes} minutes`;
  if (hours === 0) return m;
  if (minutes === 0 || hours >= 5) return h;
  return `${h} ${m}`;
}

// ── Tracking and waypoints ────────────────────────────────────────────────

export function trackingOtherTrip(tripName: string): string {
  return `You're tracking ${tripName}. Stop that first.`;
}

export function waypointMarked(name: string): string {
  return `Marked ${name}.`;
}

export function trackingStopped({ track, metric }: { track: RecordedTrack; metric: boolean }) {
  if (!trackLogRoute(track)) return 'Stopped. Too little was recorded to save a route.';
  return `Stopped. ${trackTotals({ track, metric })} Saved to your trip log.`;
}

export function trackSoFar({ track, metric }: { track: RecordedTrack; metric: boolean }) {
  if (track.distanceMeters < 10) return "You've only just started.";
  const base = `You've gone ${trackTotals({ track, metric })}`;
  return track.isPaused ? `${base} Tracking is paused.` : base;
}

/** "3.2 miles, 1,400 feet of climbing, 1 hour 20 moving." */
function trackTotals({ track, metric }: { track: RecordedTrack; metric: boolean }): string {
  const parts = [spokenDistance({ meters: track.distanceMeters, metric })];
  if (track.elevationGainMeters >= 10) {
    parts.push(`${spokenHeight({ meters: track.elevationGainMeters, metric })} of climbing`);
  }
  if (track.movingSeconds >= 60) parts.push(`${movingTime(track.movingSeconds)} moving`);
  return `${parts.join(', ')}.`;
}

/** "4 hours 10", "1 hour", "45 minutes": the way a watch reads it out. */
export function movingTime(seconds: number): string {
  const total = Math.max(1, Math.round(seconds / 60));
  const hours = Math.floor(total / 60);
  const minutes = total % 60;
  if (hours === 0) return minutes === 1 ? '1 minute' : `${minutes} minutes`;
  const h = hours === 1 ? '1 hour' : `${hours} hours`;
  return minutes === 0 ? h : `${h} ${minutes}`;
}

// ── Guidance ──────────────────────────────────────────────────────────────

export function navigationStopped(tracking: boolean): string {
  return tracking ? 'Navigation stopped. Tracking carries on.' : 'Navigation stopped.';
}

export function navigatingOtherTrip(tripName: string): string {
  return `You're navigating on ${tripName}. Stop that first.`;
}

/** "I couldn't find the bridge. You can navigate to Camp, the trailhead or the end of your route." */
export function unknownDestination({ spoken, options }: { spoken: string; options: string[] }) {
  const heard = spoken || 'that place';
  if (options.length === 0) return `I couldn't find ${heard}. ${VoiceAnswers.noDestinations}`;
  return `I couldn't find ${heard}. You can navigate to ${orList(options)}.`;
}

export function alreadyThere(name: string): string {
  return `You're already at ${name}.`;
}

/** Said when guidance starts. */
export function navigatingAnswer({
  plan,
  from,
  metric,
}: {
  plan: GuidancePlan;
  from: GeoPoint;
  metric: boolean;
}): string {
  const { name } = plan.destination;
  const length = spokenDistance({ meters: plan.lengthMeters, metric });
  if (plan.path) return `Navigating to ${name} along your route. ${capitalizeFirst(length)} to go.`;
  const toward = compassName(geoBearing(from, plan.destination.point));
  return `${capitalizeFirst(name)} is ${length} ${toward} of you. I'll tell you when you're there.`;
}

/** "How far to go" while navigating. */
export function guidanceRemaining({
  guide,
  bearing,
  metric,
}: {
  guide: RouteGuide;
  bearing: number | null;
  metric: boolean;
}): string {
  let sentence = `${capitalizeFirst(spokenDistance({ meters: guide.remainingMeters, metric }))} to ${guide.plan.destination.name}`;
  if (!guide.plan.path && bearing != null) sentence += `, ${compassName(bearing)}`;
  sentence += '.';
  if (guide.progress && !isOnRoute(guide.progress)) {
    sentence += ` You're ${spokenDistance({ meters: guide.progress.offRouteMeters, metric })} off your route.`;
  }
  return sentence;
}

/** "In 400 feet, bear left, heading north-east." */
export function turnAhead({
  turn,
  aheadMeters,
  metric,
}: {
  turn: GuidanceTurn;
  aheadMeters: number;
  metric: boolean;
}): string {
  const heading = compassName(turn.headingAfter);
  if (aheadMeters < 30) return `${capitalizeFirst(maneuver(turn))} now, heading ${heading}.`;
  return `In ${spokenDistance({ meters: aheadMeters, metric })}, ${maneuver(turn)}, heading ${heading}.`;
}

/** "You're off route. Head east about 300 feet to rejoin it." */
export function offRouteAnswer({ progress, metric }: { progress: RouteProgress; metric: boolean }) {
  return `You're off route. Head ${compassName(progress.bearingToRoute)} about ${spokenDistance({ meters: progress.offRouteMeters, metric })} to rejoin it.`;
}

export function arrived(name: string): string {
  return `You've reached ${name}.`;
}

/** What guidance says for a prompt it raised on its own. */
export function guidancePromptText({
  prompt,
  destination,
  metric,
}: {
  prompt: GuidancePrompt;
  destination: string;
  metric: boolean;
}): string {
  switch (prompt.kind) {
    case 'turn':
      return turnAhead({ turn: prompt.turn, aheadMeters: prompt.aheadMeters, metric });
    case 'milestone': {
      const direction = prompt.bearing != null ? `, ${compassName(prompt.bearing)}` : '';
      if (prompt.milestone === 'half') {
        const left = capitalizeFirst(spokenDistance({ meters: prompt.remainingMeters, metric }));
        return `Halfway to ${destination}. ${left} to go${direction}.`;
      }
      return `${metric ? '1 kilometre' : '1 mile'} to ${destination}${direction}.`;
    }
    case 'offRoute':
      return offRouteAnswer({ progress: prompt.progress, metric });
    case 'backOnRoute':
      return VoiceAnswers.backOnRoute;
    case 'arrived':
      return arrived(destination);
  }
}

/** "A, B or C". */
function orList(items: readonly string[]): string {
  if (items.length <= 1) return items[0] ?? '';
  return `${items.slice(0, -1).join(', ')} or ${items[items.length - 1]}`;
}
