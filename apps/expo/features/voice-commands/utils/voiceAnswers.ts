import type { TripConditions } from 'expo-app/features/trips/utils/tripConditions';
import { compassName, isOnRoute, type RouteProgress } from './routeProgress';
import type { VoiceCommand } from './voiceCommand';

/**
 * The sentences PackRat says back. Kept apart from the controller so every answer can be checked
 * without a microphone or a location fix.
 */
export const VoiceAnswers = Object.freeze({
  notHeard:
    "Sorry, I didn't catch that. You can say check in, where am I, how far to go, am I on route, when am I due back, add an hour, weather, or I'm safe.",
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
