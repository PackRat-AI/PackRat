/**
 * One thing the user can say to PackRat during a trip. Product behaviour:
 * docs/features/voice-commands.md.
 */
export type VoiceCommand =
  | { kind: 'startTrip' }
  | { kind: 'checkIn' }
  | { kind: 'imSafe' }
  /** Push the expected return back by an amount ("add two hours"). */
  | { kind: 'extendBy'; minutes: number }
  /** Move the expected return to a time of day ("I'll be back at eight"). */
  | { kind: 'extendUntil'; hour: number; minute: number }
  | { kind: 'whereAmI' }
  | { kind: 'howFarToGo' }
  | { kind: 'amIOnRoute' }
  | { kind: 'whenAmIDue' }
  | { kind: 'weather' }
  | { kind: 'startTracking' }
  | { kind: 'pauseTracking' }
  | { kind: 'resumeTracking' }
  | { kind: 'stopTracking' }
  /** "How far have I gone": the recording's totals so far. */
  | { kind: 'trackSoFar' }
  /** "Mark waypoint", or "mark waypoint water source" with a name. */
  | { kind: 'markWaypoint'; name: string | null }
  /** "Note: trail washed out past the bridge", in the user's own words. */
  | { kind: 'note'; text: string }
  /** "Navigate to camp": the place as said, matched against the trip later. */
  | { kind: 'navigate'; to: string }
  | { kind: 'stopNavigating' };

export type VoiceCommandKind = VoiceCommand['kind'];

/** Commands that tell other people something, so they're read back and need a spoken yes. */
export function needsConfirmation(command: VoiceCommand): boolean {
  return (
    command.kind === 'checkIn' ||
    command.kind === 'imSafe' ||
    command.kind === 'extendBy' ||
    command.kind === 'extendUntil'
  );
}

/** A spoken answer to a "Send it?" question. */
export type VoiceConfirmation = 'yes' | 'no';

/**
 * Turns what the recogniser heard into a command.
 *
 * Matching is phrase-based rather than fuzzy: a command that sends something must never be
 * guessed at, so anything not clearly one of these is null.
 */
export function parseVoiceCommand(transcript: string): VoiceCommand | null {
  const text = normalizeTranscript(transcript);
  if (!text) return null;

  // A note is the user's own words, so it's caught before anything in them ("note: I'm safe at
  // camp") can read as a command.
  const note = parseNote(transcript);
  if (note !== null) return { kind: 'note', text: note };
  const navigation = parseNavigation(text);
  if (navigation) return navigation;
  const waypoint = parseWaypoint(text);
  if (waypoint) return waypoint;
  const tracking = parseTracking(text);
  if (tracking) return tracking;

  // Return-time changes first: "I'll be back at eight" must not read as a check-in, and "add an
  // hour" must not fall through to nothing.
  const extend = parseExtend(text);
  if (extend) return extend;

  if (
    containsAny(text, [
      'im safe',
      'i am safe',
      'im back',
      'i am back',
      'im home',
      'i am home',
      'end my trip',
      'end the trip',
      'finish my trip',
      'finish the trip',
    ])
  ) {
    return { kind: 'imSafe' };
  }
  if (
    containsAny(text, [
      'check in',
      'checkin',
      'checking in',
      'send a check',
      'let them know im ok',
      'let them know i am ok',
      'tell them im ok',
      'tell them i am ok',
    ])
  ) {
    return { kind: 'checkIn' };
  }
  if (
    containsAny(text, [
      'start my trip',
      'start the trip',
      'start trip',
      'begin my trip',
      'begin the trip',
    ])
  ) {
    return { kind: 'startTrip' };
  }
  if (
    containsAny(text, [
      'on route',
      'on the route',
      'on my route',
      'on track',
      'off route',
      'off the route',
      'off track',
      'am i lost',
    ])
  ) {
    return { kind: 'amIOnRoute' };
  }
  if (
    containsAny(text, [
      'how far',
      'how much further',
      'how much farther',
      'distance to',
      'distance left',
      'miles left',
      'kilometers left',
      'km left',
      'to go',
    ])
  ) {
    return { kind: 'howFarToGo' };
  }
  if (containsAny(text, ['where am i', 'my location', 'where are we', 'current location'])) {
    return { kind: 'whereAmI' };
  }
  if (
    containsAny(text, [
      'due back',
      'when am i due',
      'return time',
      'when do i need to be back',
      'overdue',
    ])
  ) {
    return { kind: 'whenAmIDue' };
  }
  if (containsAny(text, ['weather', 'forecast', 'going to rain', 'going to snow', 'temperature'])) {
    return { kind: 'weather' };
  }
  return null;
}

export function parseVoiceConfirmation(transcript: string): VoiceConfirmation | null {
  const text = normalizeTranscript(transcript);
  const words = new Set(text.split(' '));
  const hasWord = (list: readonly string[]) => list.some((word) => words.has(word));
  // Any hesitation is a no: "I'm not sure" must never send an alert.
  if (
    containsAny(text, ['dont', 'do not', 'cancel', 'stop', 'never mind', 'nevermind', 'hold on']) ||
    hasWord(['no', 'nope', 'nah', 'not', 'wait'])
  ) {
    return 'no';
  }
  if (
    containsAny(text, ['send it', 'go ahead', 'do it', 'confirm']) ||
    hasWord(['yes', 'yeah', 'yep', 'yup', 'sure', 'ok', 'okay', 'correct', 'send'])
  ) {
    return 'yes';
  }
  return null;
}

// ── Tracking and waypoints ────────────────────────────────────────────────

const TRACK_SUBJECTS = Object.freeze([
  'tracking',
  'recording',
  'my track',
  'the track',
  'my hike',
  'the hike',
] as const);

function parseTracking(text: string): VoiceCommand | null {
  const verb = (verbs: readonly string[]) =>
    verbs.some((v) => TRACK_SUBJECTS.some((subject) => containsAny(text, [`${v} ${subject}`])));
  if (
    verb(['start', 'begin', 'record', 'track']) ||
    containsAny(text, ['track me', 'record my route'])
  )
    return { kind: 'startTracking' };
  if (verb(['pause']) || text === 'pause') return { kind: 'pauseTracking' };
  if (verb(['resume', 'continue', 'restart', 'unpause']) || text === 'resume')
    return { kind: 'resumeTracking' };
  if (verb(['stop', 'end', 'finish'])) return { kind: 'stopTracking' };
  if (
    containsAny(text, [
      'how far have i gone',
      'how far have i come',
      'how far have i walked',
      'how far have i hiked',
      'how far did i',
      'distance so far',
      'so far today',
    ])
  ) {
    return { kind: 'trackSoFar' };
  }
  return null;
}

const NAVIGATE_PHRASES = Object.freeze([
  'navigate to',
  'navigate back to',
  'take me to',
  'take me back to',
  'guide me to',
  'guide me back to',
  'directions to',
  'lead me to',
  'get me to',
  'get me back to',
  'head to',
  'head back to',
  'go to',
  'go back to',
  'way to',
  'way back to',
] as const);

/**
 * "Navigate to camp", "take me back to the car". Stopping comes first so "stop navigating to camp"
 * stops rather than starts.
 */
function parseNavigation(text: string): VoiceCommand | null {
  if (
    containsAny(text, [
      'stop navigating',
      'stop navigation',
      'end navigation',
      'cancel navigation',
      'stop guidance',
      'end guidance',
      'stop directions',
      'cancel directions',
      'stop guiding',
    ])
  ) {
    return { kind: 'stopNavigating' };
  }
  // "How far to go to camp" is a question, not a request to go there.
  if (text.startsWith('how ')) return null;
  const rest = afterPhrase(text, NAVIGATE_PHRASES);
  return rest === null ? null : { kind: 'navigate', to: rest };
}

const WAYPOINT_PHRASES = Object.freeze([
  'mark waypoint',
  'mark a waypoint',
  'add waypoint',
  'add a waypoint',
  'drop waypoint',
  'drop a waypoint',
  'save waypoint',
  'save a waypoint',
  'new waypoint',
  'drop a pin',
  'drop pin',
  'mark this spot',
  'mark this place',
  'save this spot',
  'save this place',
  'mark the spot',
] as const);

/**
 * The name is whatever follows the phrase: "mark waypoint water source" is "Water source"; a bare
 * "mark waypoint" has none.
 */
function parseWaypoint(text: string): VoiceCommand | null {
  const rest = afterPhrase(text, WAYPOINT_PHRASES);
  if (rest === null) return null;
  let words = rest ? rest.split(' ') : [];
  if (['called', 'named', 'as'].includes(words[0] ?? '')) words = words.slice(1);
  if (words.length === 1 && words[0] === 'here') words = [];
  const name = words.join(' ');
  return { kind: 'markWaypoint', name: name ? capitalizeFirst(name) : null };
}

/** What follows the first of `phrases` found as whole words, or null when none is. */
function afterPhrase(text: string, phrases: readonly string[]): string | null {
  const padded = ` ${text} `;
  const phrase = phrases.find((p) => padded.includes(` ${p} `));
  if (!phrase) return null;
  const start = padded.indexOf(` ${phrase} `) + phrase.length + 2;
  return padded.slice(start).trim();
}

const NOTE_PATTERN = /^\s*(?:(?:add|take|make|save|leave)\s+(?:a\s+)?)?note\b[\s:,.\-–—]*/i;

/**
 * "Note: trail washed out", "take a note the spring is dry". Keeps the user's own casing and
 * punctuation, only dropping the lead-in. Null when it isn't a note; an empty string when it's a
 * note with nothing in it.
 */
function parseNote(transcript: string): string | null {
  const match = NOTE_PATTERN.exec(transcript);
  if (!match) return null;
  return capitalizeFirst(transcript.slice(match[0].length).trim());
}

// ── Return time ───────────────────────────────────────────────────────────

/** "back at eight", "back by 7 30". */
const BACK_AT = / back (?:at|by) (.+)$/;
const DIGITS = /^\d+$/;

function parseExtend(text: string): VoiceCommand | null {
  // "back at eight", "back by 7 30", "back at 8 pm"
  const back = BACK_AT.exec(` ${text}`);
  if (back?.[1]) {
    const time = timeOfDay(back[1].split(' '));
    if (time) return { kind: 'extendUntil', ...time };
  }
  // "add an hour", "add two hours", "add 30 minutes", "extend by an hour and a half", "push it back
  // two hours", "give me another hour"
  if (
    !containsAny(text, ['add', 'extend', 'push', 'another', 'more time', 'running late', 'give me'])
  )
    return null;
  const words = text.split(' ');
  let minutes = 0;
  words.forEach((word, index) => {
    let unit: number;
    if (word.startsWith('hour') || word === 'hr' || word === 'hrs') unit = 60;
    else if (word.startsWith('minute') || word === 'min' || word === 'mins') unit = 1;
    else return;
    const previous = index > 0 ? words[index - 1] : undefined;
    // "half an hour", "half hour"
    if (
      unit === 60 &&
      (previous === 'half' || (previous === 'an' && words[index - 2] === 'half'))
    ) {
      minutes += 30;
      return;
    }
    minutes += ((previous === undefined ? null : spokenNumber(previous)) ?? 1) * unit;
    if (unit === 60 && words.slice(index + 1, index + 4).join(' ') === 'and a half') minutes += 30;
  });
  if (minutes === 0 && containsAny(text, ['running late', 'more time'])) minutes = 60;
  if (minutes <= 0) return null;
  return { kind: 'extendBy', minutes: Math.min(minutes, 24 * 60) };
}

const TIME_FILLERS = Object.freeze([
  'oclock',
  'o',
  'clock',
  'tonight',
  'this',
  'evening',
  'afternoon',
] as const);

/**
 * "eight", "8", "7 30", "8 pm", "seven thirty" → a 24h time. Bare hours from 1 to 11 are read as
 * afternoon or evening: on the trail, "back at eight" means tonight.
 */
function timeOfDay(words: readonly string[]): { hour: number; minute: number } | null {
  const filtered = words.filter((word) => !(TIME_FILLERS as readonly string[]).includes(word));
  const [first, ...rest] = filtered;
  let hour = first === undefined ? null : spokenNumber(first);
  if (hour === null || hour < 0 || hour > 23) return null;
  let minute = 0;
  const next = rest[0] === undefined ? null : spokenNumber(rest[0]);
  if (next !== null && next >= 0 && next <= 59) {
    minute = next;
    rest.shift();
    // "seven forty five"
    const ones = rest[0] === undefined ? null : spokenNumber(rest[0]);
    if (ones !== null && ones >= 1 && ones <= 9 && minute % 10 === 0 && minute >= 20) {
      minute += ones;
      rest.shift();
    }
  }
  const meridiem = rest[0];
  if (meridiem === 'am' || meridiem === 'morning') {
    if (hour === 12) hour = 0;
  } else if (meridiem === 'pm' || (hour >= 1 && hour <= 11)) {
    if (hour < 12) hour += 12;
  }
  return { hour, minute };
}

const NUMBER_WORDS: Readonly<Record<string, number>> = Object.freeze({
  a: 1,
  an: 1,
  one: 1,
  two: 2,
  three: 3,
  four: 4,
  five: 5,
  six: 6,
  seven: 7,
  eight: 8,
  nine: 9,
  ten: 10,
  eleven: 11,
  twelve: 12,
  fifteen: 15,
  twenty: 20,
  thirty: 30,
  forty: 40,
  fortyfive: 45,
  fifty: 50,
  another: 1,
  couple: 2,
});

function spokenNumber(word: string): number | null {
  if (DIGITS.test(word)) return Number(word);
  return NUMBER_WORDS[word] ?? null;
}

// ── Text ──────────────────────────────────────────────────────────────────

/**
 * Lowercase, no punctuation or apostrophes, single spaces, and times like "7:30" split into
 * "7 30".
 */
export function normalizeTranscript(transcript: string): string {
  return transcript
    .toLowerCase()
    .replace(/[’']/g, '')
    .replace(/[:-]/g, ' ')
    .replace(/p\.m\./g, 'pm')
    .replace(/a\.m\./g, 'am')
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim();
}

/** Whole words only, so "add" never matches inside "address". */
function containsAny(text: string, phrases: readonly string[]): boolean {
  const padded = ` ${text} `;
  return phrases.some((phrase) => padded.includes(` ${phrase} `));
}

function capitalizeFirst(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

// ── Wake phrase ───────────────────────────────────────────────────────────

const WAKE_GREETINGS = Object.freeze(['hey', 'hay', 'hi', 'okay', 'ok'] as const);
const WAKE_NAMES = Object.freeze([
  'packrat',
  'packrats',
  'pack rat',
  'pack rats',
  'pac rat',
  'pakrat',
  'packed rat',
  'back rat',
] as const);

/**
 * What was said after the last "Hey PackRat", trimmed; an empty string when nothing followed it
 * yet, null when it wasn't said. The recogniser writes the name several ways, so each is accepted.
 */
export function commandAfterWakePhrase(transcript: string): string | null {
  const padded = ` ${normalizeTranscript(transcript)} `;
  let latestEnd = -1;
  let latestStart = -1;
  for (const greeting of WAKE_GREETINGS) {
    for (const name of WAKE_NAMES) {
      const phrase = ` ${greeting} ${name} `;
      const start = padded.lastIndexOf(phrase);
      if (start > latestStart) {
        latestStart = start;
        latestEnd = start + phrase.length;
      }
    }
  }
  if (latestStart < 0) return null;
  return padded.slice(latestEnd).trim();
}
