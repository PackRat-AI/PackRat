/**
 * Copy for every message an emergency contact receives. Pure functions so the
 * wording is unit-tested. Each builder returns the plain text (SMS, and the
 * email's text part) plus the structured content the HTML email is built from,
 * so both say the same thing.
 */

export type EmailTone = 'info' | 'success' | 'warning' | 'danger' | 'neutral';

export interface EmailContent {
  tone: EmailTone;
  /** Short status label above the heading, e.g. "Trip started". */
  eyebrow: string;
  heading: string;
  paragraphs: string[];
  details: { label: string; value: string }[];
  cta?: { label: string; url: string };
}

export interface SafetyMessage {
  subject: string;
  text: string;
  email: EmailContent;
}

export interface IdentifyingGearItem {
  name: string;
  note?: string | null;
}

export interface KnownLocation {
  latitude: number;
  longitude: number;
  placeName?: string | null;
  recordedAt: Date;
}

/** "Sat 14 Sep, 7:00 PM" in the user's time zone. Falls back to UTC on a bad zone. */
export function formatMessageTime(date: Date, timeZone: string): string {
  const options: Intl.DateTimeFormatOptions = {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    hour: 'numeric',
    minute: '2-digit',
  };
  try {
    return new Intl.DateTimeFormat('en-US', { ...options, timeZone }).format(date);
  } catch {
    return new Intl.DateTimeFormat('en-US', { ...options, timeZone: 'UTC' }).format(date);
  }
}

/** "2:14 PM" in the user's time zone. */
export function formatClockTime(date: Date, timeZone: string): string {
  const options: Intl.DateTimeFormatOptions = { hour: 'numeric', minute: '2-digit' };
  try {
    return new Intl.DateTimeFormat('en-US', { ...options, timeZone }).format(date);
  } catch {
    return new Intl.DateTimeFormat('en-US', { ...options, timeZone: 'UTC' }).format(date);
  }
}

/** "orange Big Agnes tent" from { name: 'Big Agnes tent', note: 'orange' }. */
export function describeGear(gear: IdentifyingGearItem[]): string | null {
  const parts = gear
    .map((item) => {
      const name = item.name.trim();
      const note = item.note?.trim();
      return note ? `${note} ${name}` : name;
    })
    .filter((part) => part.length > 0);
  return parts.length > 0 ? parts.join(', ') : null;
}

function describePlace(location: Pick<KnownLocation, 'latitude' | 'longitude' | 'placeName'>) {
  const name = location.placeName?.trim();
  if (name) return `near ${name}`;
  return `at ${location.latitude.toFixed(4)}, ${location.longitude.toFixed(4)}`;
}

/** "4:40 PM · near Colchuck Lake (47.4960, -120.8050)" */
function describeLocationDetail(location: KnownLocation, timeZone: string) {
  const coords = `${location.latitude.toFixed(4)}, ${location.longitude.toFixed(4)}`;
  const name = location.placeName?.trim();
  return `${formatMessageTime(location.recordedAt, timeZone)} · ${name ? `near ${name} (${coords})` : coords}`;
}

/** "2 hours", "45 minutes", "1 hour". */
export function formatDuration(minutes: number): string {
  if (minutes < 60) {
    const m = Math.max(1, Math.round(minutes));
    return `${m} minute${m === 1 ? '' : 's'}`;
  }
  const h = Math.round(minutes / 60);
  return `${h} hour${h === 1 ? '' : 's'}`;
}

/** "about 2.1 mi (3.4 km)". */
export function formatDistance(meters: number): string {
  const km = meters / 1000;
  const mi = meters / 1609.344;
  return `about ${mi.toFixed(1)} mi (${km.toFixed(1)} km)`;
}

export function introMessage({ userName }: { userName: string }): SafetyMessage {
  return {
    subject: `${userName} added you as an emergency contact`,
    text:
      `PackRat: ${userName} added you as an emergency contact. When they head out on a ` +
      `trip you'll get their plan and when they're due back, and if they don't return on ` +
      `time we'll alert you. If you weren't expecting this, you can ignore it.`,
    email: {
      tone: 'neutral',
      eyebrow: 'Emergency contact',
      heading: `${userName} added you as an emergency contact`,
      paragraphs: [
        `When ${userName} heads out on a trip, you'll get an email with where they're going, when they expect to be back, and what they're carrying.`,
        `If they don't mark themselves safe by their return time, we'll alert you so you can check on them.`,
        `There's nothing you need to do now. If you weren't expecting this, you can ignore it.`,
      ],
      details: [],
    },
  };
}

export function tripStartedMessage({
  userName,
  tripName,
  expectedReturnAt,
  timeZone,
  gear,
  link,
}: {
  userName: string;
  tripName: string;
  expectedReturnAt: Date;
  timeZone: string;
  gear: IdentifyingGearItem[];
  link: string;
}): SafetyMessage {
  const carrying = describeGear(gear);
  return {
    subject: `${userName} has started their trip: ${tripName}`,
    text:
      `${userName} has started their trip: ${tripName}. ` +
      `Expected return: ${formatMessageTime(expectedReturnAt, timeZone)}. ` +
      (carrying ? `They are carrying: ${carrying}. ` : '') +
      `Track live progress: ${link}`,
    email: {
      tone: 'info',
      eyebrow: 'Trip started',
      heading: `${userName} has started their trip`,
      paragraphs: [
        `${userName} is out on ${tripName} and has asked PackRat to keep you informed. You'll hear from us when they check in, if their plans change, and when they're back.`,
      ],
      details: [
        { label: 'Trip', value: tripName },
        { label: 'Expected back', value: formatMessageTime(expectedReturnAt, timeZone) },
        ...(carrying ? [{ label: 'Look for', value: carrying }] : []),
      ],
      cta: { label: 'Follow their trip', url: link },
    },
  };
}

export function checkedInMessage({
  userName,
  tripName,
  location,
  note,
  timeZone,
  link,
}: {
  userName: string;
  tripName: string;
  location: KnownLocation;
  note?: string | null;
  timeZone: string;
  link: string;
}): SafetyMessage {
  const trimmed = note?.trim();
  return {
    subject: `${userName} checked in on ${tripName}`,
    text:
      `${userName} checked in at ${formatClockTime(location.recordedAt, timeZone)} ` +
      `${describePlace(location)}.` +
      (trimmed ? ` "${trimmed}"` : '') +
      ` Track progress: ${link}`,
    email: {
      tone: 'success',
      eyebrow: 'Check-in',
      heading: `${userName} checked in`,
      paragraphs: [`${userName} sent a check-in from ${tripName}.`],
      details: [
        { label: 'Where', value: describeLocationDetail(location, timeZone) },
        ...(trimmed ? [{ label: 'Note', value: `“${trimmed}”` }] : []),
      ],
      cta: { label: 'See their progress', url: link },
    },
  };
}

export function returnExtendedMessage({
  userName,
  tripName,
  expectedReturnAt,
  timeZone,
  link,
}: {
  userName: string;
  tripName: string;
  expectedReturnAt: Date;
  timeZone: string;
  link: string;
}): SafetyMessage {
  return {
    subject: `${userName} updated their return time`,
    text:
      `${userName} has updated their expected return from ${tripName} to ` +
      `${formatMessageTime(expectedReturnAt, timeZone)}. Trip details: ${link}`,
    email: {
      tone: 'info',
      eyebrow: 'Plan changed',
      heading: `${userName} will be back later than planned`,
      paragraphs: [
        `${userName} has pushed back their return from ${tripName}. The overdue alert moves with it.`,
      ],
      details: [
        { label: 'Trip', value: tripName },
        { label: 'Now expected back', value: formatMessageTime(expectedReturnAt, timeZone) },
      ],
      cta: { label: 'View trip details', url: link },
    },
  };
}

export function offRouteMessage({
  userName,
  tripName,
  distanceMeters,
  link,
}: {
  userName: string;
  tripName: string;
  distanceMeters: number;
  link: string;
}): SafetyMessage {
  return {
    subject: `${userName} is off their planned route`,
    text:
      `${userName} is ${formatDistance(distanceMeters)} off their planned route for ` +
      `${tripName}. Latest location: ${link}`,
    email: {
      tone: 'warning',
      eyebrow: 'Off route',
      heading: `${userName} is off their planned route`,
      paragraphs: [
        `${userName}'s latest location on ${tripName} is ${formatDistance(distanceMeters)} from the route they planned. This may be a deliberate change of plan; their progress map shows where they are.`,
      ],
      details: [{ label: 'Trip', value: tripName }],
      cta: { label: 'See latest location', url: link },
    },
  };
}

export function overdueMessage({
  userName,
  tripName,
  overdueMinutes,
  lastKnown,
  timeZone,
  link,
}: {
  userName: string;
  tripName: string;
  overdueMinutes: number;
  lastKnown: KnownLocation | null;
  timeZone: string;
  link: string;
}): SafetyMessage {
  const last = lastKnown
    ? `Last known location: ${formatClockTime(lastKnown.recordedAt, timeZone)} ${describePlace(lastKnown)}. `
    : 'No location has been shared since they set out. ';
  return {
    subject: `${userName} is overdue on ${tripName}`,
    text:
      `${userName} is overdue on ${tripName} by ${formatDuration(overdueMinutes)}. ` +
      last +
      `Full gear list and trip details: ${link}. Please contact the authorities.`,
    email: {
      tone: 'danger',
      eyebrow: 'Overdue',
      heading: `${userName} is overdue by ${formatDuration(overdueMinutes)}`,
      paragraphs: [
        `${userName} hasn't marked themselves safe from ${tripName}. Try to reach them first. If you can't, contact the local authorities and share the trip page below: it has their plan, last known location and full gear list.`,
      ],
      details: [
        { label: 'Trip', value: tripName },
        {
          label: 'Last known location',
          value: lastKnown
            ? describeLocationDetail(lastKnown, timeZone)
            : 'None shared since they set out',
        },
      ],
      cta: { label: 'Open trip page', url: link },
    },
  };
}

export function safeMessage({
  userName,
  tripName,
  afterOverdueAlert,
}: {
  userName: string;
  tripName: string;
  afterOverdueAlert: boolean;
}): SafetyMessage {
  if (afterOverdueAlert) {
    return {
      subject: `Update: ${userName} is safe`,
      text:
        `Update: ${userName} has marked themselves safe after ${tripName}. ` +
        `No further action is needed.`,
      email: {
        tone: 'success',
        eyebrow: 'Safe',
        heading: `${userName} is safe`,
        paragraphs: [
          `${userName} has marked themselves safe after ${tripName}. No further action is needed. Thank you for keeping an eye out.`,
        ],
        details: [],
      },
    };
  }
  return {
    subject: `${userName} is back safe`,
    text: `${userName} is back safe from ${tripName}. Thanks for keeping an eye out.`,
    email: {
      tone: 'success',
      eyebrow: 'Back safe',
      heading: `${userName} is back safe`,
      paragraphs: [
        `${userName} has finished ${tripName} and marked themselves safe. Their location history for the trip has been deleted. Thanks for keeping an eye out.`,
      ],
      details: [],
    },
  };
}

export function cancelledMessage({
  userName,
  tripName,
}: {
  userName: string;
  tripName: string;
}): SafetyMessage {
  return {
    subject: `${userName} ended their safety check-in`,
    text:
      `${userName} has called off the safety check-in for ${tripName}. ` +
      `You won't receive further updates for this trip.`,
    email: {
      tone: 'neutral',
      eyebrow: 'Check-in ended',
      heading: `${userName} ended their safety check-in`,
      paragraphs: [
        `${userName} has called off the safety check-in for ${tripName}. You won't receive further updates or an overdue alert for this trip.`,
      ],
      details: [],
    },
  };
}
