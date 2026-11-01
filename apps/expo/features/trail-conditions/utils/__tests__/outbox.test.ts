import { describe, expect, it } from 'vitest';
import {
  filterReports,
  isRetryableSendError,
  mergeQueuedIntoFeed,
  pendingReport,
  photoKeys,
  type QueuedReport,
  TrailConditionsRequestError,
} from '../outbox';
import type { SignedReport } from '../trails';

const queued = (overrides: Partial<QueuedReport> = {}): QueuedReport => ({
  id: 'q1',
  input: {
    place: { kind: 'trail', trail: { id: 't1', name: 'Lost Lake' } },
    writtenFrom: { latitude: 47, longitude: -122 },
    surface: 'dirt',
    overallCondition: 'fair',
    hazards: ['ice'],
    notes: 'Icy above the lake',
    tripId: 'trip1',
  },
  photos: [],
  writtenAt: '2026-10-01T10:00:00.000Z',
  authorId: 'u1',
  attempts: 0,
  ...overrides,
});

describe('isRetryableSendError', () => {
  it.each([
    [new Error('Network request failed'), true],
    [new TrailConditionsRequestError('x', null), true],
    [new TrailConditionsRequestError('x', 500), true],
    [new TrailConditionsRequestError('x', 503), true],
    [new TrailConditionsRequestError('x', 408), true],
    [new TrailConditionsRequestError('x', 429), true],
    [new TrailConditionsRequestError('x', 400), false],
    [new TrailConditionsRequestError('x', 422), false],
    [new TrailConditionsRequestError('x', 403), false],
  ])('%s retries: %s', (error, expected) => {
    expect(isRetryableSendError(error)).toBe(expected);
  });
});

describe('photoKeys', () => {
  it('returns the keys when every photo is uploaded', () => {
    expect(photoKeys([{ key: 'a' }, { key: 'b' }])).toEqual(['a', 'b']);
  });

  it('returns null while any photo is only on the device', () => {
    expect(photoKeys([{ key: 'a' }, { uri: 'file:///b.jpg' }])).toBeNull();
  });
});

describe('pendingReport', () => {
  it('shows a queued trail report as the hiker wrote it', () => {
    const report = pendingReport(queued({ photos: [{ key: 'k1' }, { uri: 'file:///local.jpg' }] }));
    expect(report).toMatchObject({
      id: 'q1',
      trailId: 't1',
      trailName: 'Lost Lake',
      latitude: 47,
      longitude: -122,
      overallCondition: 'fair',
      hazards: ['ice'],
      notes: 'Icy above the lake',
      photos: ['k1'],
      userId: 'u1',
      tripId: 'trip1',
      localCreatedAt: '2026-10-01T10:00:00.000Z',
    });
  });

  it('places a pinned report at its pin and leaves optional fields empty', () => {
    const report = pendingReport(
      queued({
        authorId: null,
        input: {
          place: { kind: 'pin', label: 'Spur', latitude: 1, longitude: 2 },
          surface: 'mud',
          overallCondition: 'poor',
          hazards: [],
        },
      }),
    );
    expect(report).toMatchObject({
      trailId: null,
      trailName: 'Spur',
      latitude: 1,
      longitude: 2,
      notes: null,
      tripId: null,
      userId: undefined,
    });
  });

  it('has no coordinate for a trail report written without a fix', () => {
    const base = queued();
    const report = pendingReport({ ...base, input: { ...base.input, writtenFrom: undefined } });
    expect(report.latitude).toBeNull();
  });
});

describe('mergeQueuedIntoFeed', () => {
  const sent = { ...pendingReport(queued({ id: 'sent' })), authorName: 'Ana' } as SignedReport;

  it('puts unsent reports first, newest first, and drops ones the server already has', () => {
    const merged = mergeQueuedIntoFeed(
      [
        queued({ id: 'old', writtenAt: '2026-10-01T00:00:00.000Z' }),
        queued({ id: 'sent' }),
        queued({ id: 'new', writtenAt: '2026-10-02T00:00:00.000Z' }),
      ],
      [sent],
    );
    expect(merged.map((r) => r.id)).toEqual(['new', 'old', 'sent']);
    expect(merged[2]?.authorName).toBe('Ana');
  });
});

describe('filterReports', () => {
  const reports = [
    { trailName: 'Lost Lake', trailRegion: 'WA', notes: null },
    { trailName: 'Spur', trailRegion: null, notes: 'Washed out bridge' },
  ];

  it('returns everything for a blank search', () => {
    expect(filterReports(reports, '  ')).toBe(reports);
  });

  it('matches name, region and notes case-insensitively', () => {
    expect(filterReports(reports, 'lake')).toEqual([reports[0]]);
    expect(filterReports(reports, 'wa')).toEqual(reports);
    expect(filterReports(reports, 'BRIDGE')).toEqual([reports[1]]);
  });
});
