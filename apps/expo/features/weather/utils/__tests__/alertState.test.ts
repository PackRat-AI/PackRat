import { describe, expect, it } from 'vitest';
import {
  alertId,
  alertSeverityTone,
  alertTitle,
  hasUnseenAlert,
  markAlertsSeen,
} from '../alertState';

const flood = {
  event: 'Flood Warning',
  effective: '2026-10-19T10:00:00Z',
  expires: '2026-10-19T18:00:00Z',
  areas: 'Kanab',
  headline: 'Flood Warning until 6 PM',
};
const wind = { ...flood, event: 'Wind Advisory', headline: 'Wind Advisory' };

describe('alertId', () => {
  it('joins the issuance fields in a fixed order', () => {
    expect(alertId(flood)).toBe(
      'Flood Warning|2026-10-19T10:00:00Z|2026-10-19T18:00:00Z|Kanab|Flood Warning until 6 PM',
    );
  });
});

describe('hasUnseenAlert', () => {
  it('is false with no alerts', () => {
    expect(hasUnseenAlert({ locationId: 1, alerts: [], seen: {} })).toBe(false);
    expect(hasUnseenAlert({ locationId: 1, alerts: undefined, seen: {} })).toBe(false);
  });

  it('is true when the lead alert was never seen', () => {
    expect(hasUnseenAlert({ locationId: 1, alerts: [flood], seen: {} })).toBe(true);
  });

  it('is false once the lead alert is seen, whatever follows it', () => {
    const seen = { '1': [alertId(flood)] };
    expect(hasUnseenAlert({ locationId: 1, alerts: [flood, wind], seen })).toBe(false);
  });

  it('reads seen ids per location', () => {
    const seen = { '2': [alertId(flood)] };
    expect(hasUnseenAlert({ locationId: 1, alerts: [flood], seen })).toBe(true);
  });
});

describe('markAlertsSeen', () => {
  it('replaces the location set with the current alerts', () => {
    const seen = { '1': ['stale'], '2': ['other'] };
    expect(markAlertsSeen({ locationId: 1, alerts: [flood, wind], seen })).toEqual({
      '1': [alertId(flood), alertId(wind)],
      '2': ['other'],
    });
  });

  it('returns the same object when nothing changed, so storage is not rewritten', () => {
    const seen = { '1': [alertId(wind), alertId(flood)] };
    expect(markAlertsSeen({ locationId: 1, alerts: [flood, wind], seen })).toBe(seen);
  });

  it('records an empty set when every alert has cleared', () => {
    expect(markAlertsSeen({ locationId: 1, alerts: [], seen: { '1': ['x'] } })).toEqual({
      '1': [],
    });
  });
});

describe('alertSeverityTone', () => {
  it('maps the known severities regardless of case and padding', () => {
    expect(alertSeverityTone('Extreme')).toBe('extreme');
    expect(alertSeverityTone(' severe ')).toBe('severe');
    expect(alertSeverityTone('MODERATE')).toBe('moderate');
  });

  it('falls back for anything else', () => {
    expect(alertSeverityTone('Minor')).toBe('other');
    expect(alertSeverityTone(undefined)).toBe('other');
  });
});

describe('alertTitle', () => {
  it('prefers the event, then the headline, then a generic title', () => {
    expect(alertTitle(flood)).toBe('Flood Warning');
    expect(alertTitle({ event: '', headline: 'Heads up' })).toBe('Heads up');
    expect(alertTitle({ event: '', headline: '' })).toBe('Weather Alert');
  });

  it('skips a generic event word for the headline, in sentence case', () => {
    expect(alertTitle({ event: 'weather', headline: 'special weather statement in effect' })).toBe(
      'Special weather statement in effect',
    );
    expect(alertTitle({ event: 'weather', headline: '' })).toBe('Weather');
  });
});
