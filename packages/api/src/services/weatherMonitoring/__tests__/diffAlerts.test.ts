import type { WeatherAlertItem } from '@packrat/schemas/weather';
import { describe, expect, it } from 'vitest';
import { alertId, alertSetHash, diffAlerts } from '../diffAlerts';

function makeAlert(overrides: Partial<WeatherAlertItem> = {}): WeatherAlertItem {
  return {
    headline: 'Severe Thunderstorm Warning',
    msgtype: 'Alert',
    severity: 'Severe',
    urgency: 'Immediate',
    areas: 'Test County',
    category: 'Met',
    certainty: 'Observed',
    event: 'Severe Thunderstorm Warning',
    effective: '2026-06-01T12:00:00Z',
    expires: '2026-06-01T18:00:00Z',
    desc: 'A severe thunderstorm is occurring.',
    ...overrides,
  };
}

describe('alertId', () => {
  it('combines event and effective time', () => {
    const alert = makeAlert({ event: 'Flood Warning', effective: '2026-01-01T00:00:00Z' });
    expect(alertId(alert)).toBe('Flood Warning|2026-01-01T00:00:00Z');
  });

  it('treats the same event re-issued with a new effective time as a different alert', () => {
    const first = makeAlert({ event: 'Tornado Warning', effective: '2026-01-01T00:00:00Z' });
    const second = makeAlert({ event: 'Tornado Warning', effective: '2026-01-01T01:00:00Z' });
    expect(alertId(first)).not.toBe(alertId(second));
  });
});

describe('alertSetHash', () => {
  it('is identical regardless of array order', () => {
    const a = makeAlert({ event: 'A', effective: '1' });
    const b = makeAlert({ event: 'B', effective: '2' });
    expect(alertSetHash([a, b])).toBe(alertSetHash([b, a]));
  });

  it('differs when the alert set differs', () => {
    const a = makeAlert({ event: 'A', effective: '1' });
    const b = makeAlert({ event: 'B', effective: '2' });
    expect(alertSetHash([a])).not.toBe(alertSetHash([a, b]));
  });

  it('is empty-string stable for no alerts', () => {
    expect(alertSetHash([])).toBe('');
  });
});

describe('diffAlerts', () => {
  it('reports every alert as new when there was no previous state', () => {
    const alert = makeAlert();
    const result = diffAlerts({ previousIds: [], currentAlerts: [alert] });

    expect(result.newAlerts).toEqual([alert]);
    expect(result.resolvedIds).toEqual([]);
    expect(result.currentIds).toEqual([alertId(alert)]);
  });

  it('reports no new alerts when the active set is unchanged', () => {
    const alert = makeAlert();
    const result = diffAlerts({ previousIds: [alertId(alert)], currentAlerts: [alert] });

    expect(result.newAlerts).toEqual([]);
    expect(result.resolvedIds).toEqual([]);
  });

  it('reports a resolved alert when it drops out of the active set', () => {
    const alert = makeAlert();
    const result = diffAlerts({ previousIds: [alertId(alert)], currentAlerts: [] });

    expect(result.newAlerts).toEqual([]);
    expect(result.resolvedIds).toEqual([alertId(alert)]);
    expect(result.currentIds).toEqual([]);
  });

  it('reports both a new and a resolved alert in the same poll', () => {
    const resolved = makeAlert({ event: 'Flood Warning', effective: '2026-01-01T00:00:00Z' });
    const added = makeAlert({ event: 'Tornado Warning', effective: '2026-01-02T00:00:00Z' });
    const result = diffAlerts({
      previousIds: [alertId(resolved)],
      currentAlerts: [added],
    });

    expect(result.newAlerts).toEqual([added]);
    expect(result.resolvedIds).toEqual([alertId(resolved)]);
    expect(result.currentIds).toEqual([alertId(added)]);
  });

  it('handles multiple simultaneous new alerts for the same location', () => {
    const first = makeAlert({ event: 'Flood Warning', effective: '2026-01-01T00:00:00Z' });
    const second = makeAlert({ event: 'High Wind Warning', effective: '2026-01-01T00:00:00Z' });
    const result = diffAlerts({ previousIds: [], currentAlerts: [first, second] });

    expect(result.newAlerts).toHaveLength(2);
    expect(result.newAlerts).toEqual(expect.arrayContaining([first, second]));
    expect(result.currentIds).toEqual(expect.arrayContaining([alertId(first), alertId(second)]));
  });

  it('does not re-report an alert still active across polls, even amid other changes', () => {
    const ongoing = makeAlert({ event: 'Winter Storm Warning', effective: '2026-01-01T00:00:00Z' });
    const newOne = makeAlert({ event: 'Ice Storm Warning', effective: '2026-01-02T00:00:00Z' });
    const result = diffAlerts({
      previousIds: [alertId(ongoing)],
      currentAlerts: [ongoing, newOne],
    });

    expect(result.newAlerts).toEqual([newOne]);
    expect(result.resolvedIds).toEqual([]);
  });

  it('produces a hash matching alertSetHash for the current alerts', () => {
    const alert = makeAlert();
    const result = diffAlerts({ previousIds: [], currentAlerts: [alert] });
    expect(result.hash).toBe(alertSetHash([alert]));
  });
});
