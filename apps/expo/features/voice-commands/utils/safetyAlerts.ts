import type { LocalSafetyCheckIn } from 'expo-app/features/safety-check-in/types';
import { overdueAt } from 'expo-app/features/safety-check-in/utils/safetyCheckIn';
import { lowBattery, overdueSoon, weatherAlert } from './voiceAnswers';

/** The overdue warning comes this long before the contacts are told. */
export const OVERDUE_LEAD_MS = 60 * 60_000;

/** Battery levels that get a warning, lowest first. */
const BATTERY_STEPS = Object.freeze([10, 20] as const);

export type SafetyAlertKind = 'overdue' | 'battery' | 'weather';

export interface SafetyAlert {
  /** Said once per trip under this key. */
  key: string;
  kind: SafetyAlertKind;
  /** The notification's title; the overdue reminder is already scheduled, so it has none. */
  title: string | null;
  text: string;
}

export interface WeatherWarning {
  event: string;
  headline?: string | null;
  severity?: string | null;
}

export function batteryKey(step: number): string {
  return `battery-${step}`;
}

/** What's due to be said now, before anything already said is skipped. */
export function dueSafetyAlerts({
  checkIn,
  contacts,
  battery,
  weather,
  tracking,
  now,
}: {
  checkIn: LocalSafetyCheckIn | null | undefined;
  /** "Sam and Jo", for the overdue warning. */
  contacts: string;
  /** 0–1, or null when the phone can't say. */
  battery: { level: number; charging: boolean } | null;
  weather: readonly WeatherWarning[];
  tracking: boolean;
  now: Date;
}): SafetyAlert[] {
  const alerts: SafetyAlert[] = [];

  // The live forecast and the trip's own one can carry the same alert; it's said once.
  const seen = new Set<string>();
  for (const warning of weather) {
    const event = warning.event.trim();
    const severity = warning.severity?.toLowerCase() ?? '';
    if (!event || !['severe', 'extreme'].includes(severity)) continue;
    const key = `weather-${event.toLowerCase()}`;
    if (seen.has(key)) continue;
    seen.add(key);
    alerts.push({
      key,
      kind: 'weather',
      title: titleCase(event),
      text: weatherAlert({ event, headline: warning.headline }),
    });
  }

  if (checkIn && !checkIn.overdueAlertSent) {
    const due = overdueAt(checkIn);
    const left = due.getTime() - now.getTime();
    if (left > 0 && left <= OVERDUE_LEAD_MS) {
      alerts.push({
        key: `overdue-${checkIn.id}-${due.getTime()}`,
        kind: 'overdue',
        title: null,
        text: overdueSoon({ contacts, overdueAt: due, now }),
      });
    }
  }

  if (battery && !battery.charging && battery.level >= 0) {
    const step = BATTERY_STEPS.find((limit) => battery.level <= limit / 100);
    if (step) {
      alerts.push({
        key: batteryKey(step),
        kind: 'battery',
        title: 'Low battery',
        text: lowBattery({ percent: Math.round(battery.level * 100), tracking }),
      });
    }
  }

  return alerts;
}

function titleCase(text: string): string {
  return text.toLowerCase().replace(/\b\p{L}/gu, (letter) => letter.toUpperCase());
}
