import type { LocalSafetyCheckIn } from 'expo-app/features/safety-check-in/types';
import { describe, expect, it } from 'vitest';
import { dueSafetyAlerts } from '../safetyAlerts';
import { lowBattery, overdueSoon, weatherAlert } from '../voiceAnswers';

const now = new Date('2026-11-17T15:00:00Z');

function checkIn(overrides: Partial<LocalSafetyCheckIn> = {}): LocalSafetyCheckIn {
  return {
    id: 'c1',
    tripId: 't1',
    tripName: 'Enchantments Traverse',
    contactNames: ['Sam', 'Jo'],
    // Overdue at 16:00: due back 15:30 plus 30 minutes' grace.
    expectedReturnAt: '2026-11-17T15:30:00.000Z',
    graceMinutes: 30,
    trackingEnabled: false,
    startedAt: '2026-11-17T08:00:00.000Z',
    ...overrides,
  };
}

function due(input: Partial<Parameters<typeof dueSafetyAlerts>[0]> = {}) {
  return dueSafetyAlerts({
    checkIn: null,
    contacts: 'Sam and Jo',
    battery: null,
    weather: [],
    tracking: false,
    now,
    ...input,
  });
}

describe('dueSafetyAlerts', () => {
  it('says nothing when all is well', () => {
    expect(due({ battery: { level: 0.8, charging: false } })).toEqual([]);
  });

  it('warns an hour before the contacts are told, once per return time', () => {
    const [alert] = due({ checkIn: checkIn() });
    expect(alert).toEqual({
      key: `overdue-c1-${Date.parse('2026-11-17T16:00:00Z')}`,
      kind: 'overdue',
      title: null,
      text: "Heads up. Sam and Jo will be told you're overdue in 1 hour. Say I'm safe, or add an hour.",
    });
  });

  it('skips the overdue warning when it is more than an hour off, past, or already sent', () => {
    expect(due({ checkIn: checkIn({ expectedReturnAt: '2026-11-17T16:00:00.000Z' }) })).toEqual([]);
    expect(due({ checkIn: checkIn({ expectedReturnAt: '2026-11-17T14:00:00.000Z' }) })).toEqual([]);
    expect(due({ checkIn: checkIn({ overdueAlertSent: true }) })).toEqual([]);
  });

  it('warns at 20 and 10 percent, only while not charging', () => {
    expect(due({ battery: { level: 0.2, charging: false } }).map((a) => a.key)).toEqual([
      'battery-20',
    ]);
    expect(due({ battery: { level: 0.08, charging: false } }).map((a) => a.key)).toEqual([
      'battery-10',
    ]);
    expect(due({ battery: { level: 0.08, charging: true } })).toEqual([]);
  });

  it('mentions tracking in the battery warning while recording', () => {
    const [alert] = due({ battery: { level: 0.15, charging: false }, tracking: true });
    expect(alert?.text).toBe('Your battery is at 15 percent. Tracking will stop if it runs out.');
  });

  it('says severe and extreme weather once, however many forecasts carry it', () => {
    const alerts = due({
      weather: [
        {
          event: 'winter storm warning',
          headline: 'Heavy snow above 5000 feet.',
          severity: 'Severe',
        },
        { event: 'Winter Storm Warning', severity: 'severe' },
        { event: 'Wind Advisory', severity: 'Moderate' },
      ],
    });
    expect(alerts).toEqual([
      {
        key: 'weather-winter storm warning',
        kind: 'weather',
        title: 'Winter Storm Warning',
        text: 'Weather alert. Winter storm warning in effect for your area. Heavy snow above 5000 feet.',
      },
    ]);
  });
});

describe('safety alert answers', () => {
  it('drops a headline that only repeats the event', () => {
    expect(weatherAlert({ event: 'Flood Watch', headline: 'flood watch' })).toBe(
      'Weather alert. Flood Watch in effect for your area.',
    );
  });

  it('says how long is left before the overdue alert', () => {
    expect(
      overdueSoon({ contacts: 'sam', overdueAt: new Date(now.getTime() + 45 * 60_000), now }),
    ).toBe(
      "Heads up. Sam will be told you're overdue in 45 minutes. Say I'm safe, or add an hour.",
    );
  });

  it('warns the phone may turn off when not tracking', () => {
    expect(lowBattery({ percent: 20, tracking: false })).toBe(
      "Your battery is at 20 percent. Your phone may turn off before you're back.",
    );
  });
});
