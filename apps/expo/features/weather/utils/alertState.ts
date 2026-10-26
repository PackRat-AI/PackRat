import type { WeatherAlertItem } from '@packrat/schemas/weather';

/** Seen alert ids per saved location, keyed by the location id as a string. */
export type SeenAlertIds = Record<string, string[]>;

type AlertIdentity = Pick<
  WeatherAlertItem,
  'event' | 'effective' | 'expires' | 'areas' | 'headline'
>;

/**
 * A stable identity for an alert across fetches. The forecast carries no id of
 * its own, so this joins the fields that together name one issuance — the same
 * key the iOS app uses, so a location reads the same on both.
 */
export function alertId(alert: AlertIdentity): string {
  return [alert.event, alert.effective, alert.expires, alert.areas, alert.headline].join('|');
}

/**
 * True when the location's lead alert has not been seen. Only the first alert
 * counts: it is the one the list card names, so it is the one the marker is
 * about.
 */
export function hasUnseenAlert({
  locationId,
  alerts,
  seen,
}: {
  locationId: number;
  alerts: readonly AlertIdentity[] | undefined;
  seen: SeenAlertIds;
}): boolean {
  const lead = alerts?.[0];
  if (!lead) return false;
  return !(seen[String(locationId)] ?? []).includes(alertId(lead));
}

/**
 * Records every alert currently on a location as seen. Replaces the location's
 * set rather than growing it, so expired alerts fall out on their own.
 */
export function markAlertsSeen({
  locationId,
  alerts,
  seen,
}: {
  locationId: number;
  alerts: readonly AlertIdentity[];
  seen: SeenAlertIds;
}): SeenAlertIds {
  const key = String(locationId);
  const next = alerts.map(alertId);
  const current = seen[key] ?? [];
  if (next.length === current.length && next.every((id) => current.includes(id))) return seen;
  return { ...seen, [key]: next };
}

export type AlertSeverityTone = 'extreme' | 'severe' | 'moderate' | 'other';

/** Maps the forecast's free-text severity onto the four tones the UI colours. */
export function alertSeverityTone(severity: string | undefined): AlertSeverityTone {
  switch (severity?.trim().toLowerCase()) {
    case 'extreme':
      return 'extreme';
    case 'severe':
      return 'severe';
    case 'moderate':
      return 'moderate';
    default:
      return 'other';
  }
}

// Some issuers (Environment Canada, via the forecast provider) send the bare
// word "weather" as the event; the headline names the actual statement.
const GENERIC_EVENTS = Object.freeze(new Set(['weather', 'alert']));

function sentenceCase(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

/** Card title for an alert: its event name, else its headline. */
export function alertTitle(alert: Pick<WeatherAlertItem, 'event' | 'headline'>): string {
  const event = alert.event?.trim() ?? '';
  const headline = alert.headline?.trim() ?? '';
  if (event && !GENERIC_EVENTS.has(event.toLowerCase())) return event;
  if (headline) return sentenceCase(headline);
  return event ? sentenceCase(event) : 'Weather Alert';
}
