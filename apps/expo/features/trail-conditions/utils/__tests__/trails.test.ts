import { describe, expect, it } from 'vitest';
import {
  DEFAULT_PIN_LABEL,
  formatTrailDistance,
  isPinnedReport,
  makePin,
  placeDisplayName,
  placeTrailId,
  type ReportPlace,
  reportCoordinate,
  SignedReportSchema,
  TrailDetailSchema,
  TrailSearchResponseSchema,
  TripConditionsResponseSchema,
  trailSubtitle,
} from '../trails';

const summary = { id: 't1', name: 'Lost Lake', lengthM: 4200, center: null, distanceM: null };

const report = {
  id: 'r1',
  trailId: 't1',
  trailName: 'Lost Lake',
  surface: 'dirt',
  overallCondition: 'good',
  hazards: [],
  waterCrossings: 0,
  photos: [],
  deleted: false,
};

describe('TrailDetailSchema', () => {
  it('turns a LineString into one line of lon/lat pairs', () => {
    const detail = TrailDetailSchema.parse({
      ...summary,
      geometry: {
        type: 'LineString',
        coordinates: [
          [-122.1, 47.5, 300],
          [-122.2, 47.6],
        ],
      },
    });
    expect(detail.lines).toEqual([
      [
        [-122.1, 47.5],
        [-122.2, 47.6],
      ],
    ]);
    expect(detail.summary).toEqual(summary);
  });

  it('keeps each stretch of a MultiLineString', () => {
    const detail = TrailDetailSchema.parse({
      ...summary,
      geometry: {
        type: 'MultiLineString',
        coordinates: [[[1, 2]], [[3, 4]]],
      },
    });
    expect(detail.lines).toEqual([[[1, 2]], [[3, 4]]]);
  });

  it('leaves a trail with unknown geometry without a line', () => {
    const detail = TrailDetailSchema.parse({ ...summary, geometry: { type: 'Point' } });
    expect(detail.lines).toEqual([]);
  });
});

describe('response schemas', () => {
  it('parses a search response', () => {
    const parsed = TrailSearchResponseSchema.parse({ trails: [{ ...summary, distanceM: 120 }] });
    expect(parsed.trails[0]?.distanceM).toBe(120);
  });

  it('parses a signed report with its trip-only fields', () => {
    const parsed = SignedReportSchema.parse({ ...report, authorName: 'Ana', unread: true });
    expect(parsed).toMatchObject({ authorName: 'Ana', unread: true });
  });

  it('rejects an unknown trip scope', () => {
    expect(() => TripConditionsResponseSchema.parse({ scope: 'region', reports: [] })).toThrow();
  });
});

describe('places', () => {
  const trail: ReportPlace = { kind: 'trail', trail: { id: 't1', name: 'Lost Lake' } };
  const pin: ReportPlace = { kind: 'pin', label: 'Spur', latitude: 1, longitude: 2 };

  it('names and identifies a trail', () => {
    expect(placeDisplayName(trail)).toBe('Lost Lake');
    expect(placeTrailId(trail)).toBe('t1');
  });

  it('names a pin by its label and gives it no trail', () => {
    expect(placeDisplayName(pin)).toBe('Spur');
    expect(placeTrailId(pin)).toBeNull();
  });

  it('labels a blank pin with the default', () => {
    expect(makePin({ label: '  ', latitude: 1, longitude: 2 })).toEqual({
      kind: 'pin',
      label: DEFAULT_PIN_LABEL,
      latitude: 1,
      longitude: 2,
    });
    expect(makePin({ label: ' Spur ', latitude: 1, longitude: 2 })).toMatchObject({
      label: 'Spur',
    });
  });

  it('records the device position for a trail and the pin itself for a pin', () => {
    const here = { latitude: 9, longitude: 8 };
    expect(reportCoordinate({ place: trail, writtenFrom: here })).toEqual(here);
    expect(reportCoordinate({ place: trail, writtenFrom: null })).toBeNull();
    expect(reportCoordinate({ place: pin, writtenFrom: here })).toEqual({
      latitude: 1,
      longitude: 2,
    });
  });

  it('recognises a pinned report', () => {
    expect(isPinnedReport({ trailId: null, latitude: 1 })).toBe(true);
    expect(isPinnedReport({ trailId: 't1', latitude: 1 })).toBe(false);
    expect(isPinnedReport({ trailId: null, latitude: null })).toBe(false);
  });
});

describe('formatTrailDistance', () => {
  it.each([
    { meters: 20, imperial: false, expected: '20 m' },
    { meters: 4200, imperial: false, expected: '4.2 km' },
    { meters: 12_400, imperial: false, expected: '12 km' },
    { meters: 30, imperial: true, expected: '98 ft' },
    { meters: 4200, imperial: true, expected: '2.6 mi' },
    { meters: 20_000, imperial: true, expected: '12 mi' },
  ])('$meters m (imperial $imperial) reads $expected', ({ meters, imperial, expected }) => {
    expect(formatTrailDistance({ meters, imperial })).toBe(expected);
  });
});

describe('trailSubtitle', () => {
  it('shows length alone without a search centre', () => {
    expect(trailSubtitle({ trail: summary, imperial: false })).toBe('4.2 km');
  });

  it('adds how far away when there is one', () => {
    expect(trailSubtitle({ trail: { ...summary, distanceM: 1500 }, imperial: false })).toBe(
      '4.2 km · 1.5 km away',
    );
  });
});
