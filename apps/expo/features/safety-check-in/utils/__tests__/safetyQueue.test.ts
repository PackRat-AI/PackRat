import type { SafetyCheckIn } from '@packrat/schemas/safetyCheckIn';
import { describe, expect, it } from 'vitest';
import type { EmergencyContact, SafetyLocationFix } from '../../types';
import {
  confirmStart,
  dropRefused,
  EMPTY_SAFETY_STATE,
  endCheckIn,
  extendCheckIn,
  hasTrackingCheckIn,
  isRetryable,
  pendingCount,
  reconcileRemote,
  recordCheckIn,
  recordTrackPoints,
  type SafetyState,
  startCheckIn,
} from '../safetyQueue';

const mom: EmergencyContact = {
  id: 'c1',
  name: 'Mom',
  phone: null,
  email: 'mom@example.com',
  isDefault: true,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
};

const now = new Date('2026-09-12T15:00:00.000Z');
const fix: SafetyLocationFix = {
  latitude: 47.5,
  longitude: -120.8,
  accuracy: 12,
  recordedAt: new Date('2026-09-12T18:00:00.000Z'),
  placeName: ' Colchuck Lake ',
};

function started({ tracking = false, id = 'ci1' }: { tracking?: boolean; id?: string } = {}) {
  return startCheckIn({
    state: EMPTY_SAFETY_STATE,
    id,
    tripId: 't1',
    tripName: 'Enchantments',
    contacts: [mom],
    expectedReturnAt: new Date('2026-09-14T02:00:00.000Z'),
    graceMinutes: 120,
    gear: [
      { name: ' tent ', note: 'orange' },
      { name: '', note: null },
    ],
    trackingEnabled: tracking,
    now,
    timeZone: 'America/Los_Angeles',
  }).state;
}

function remote(overrides: Partial<SafetyCheckIn> = {}): SafetyCheckIn {
  return {
    id: 'ci1',
    tripId: 't1',
    status: 'active',
    shareUrl: 'https://api.example.com/api/safety/token',
    expectedReturnAt: '2026-09-14T02:00:00.000Z',
    graceMinutes: 120,
    overdueAt: '2026-09-14T04:00:00.000Z',
    identifyingGear: [],
    trackingEnabled: true,
    startedAt: now.toISOString(),
    overdueAlertSentAt: null,
    endedAt: null,
    contacts: [{ contactId: 'c1', name: 'Mom' }],
    lastLocation: null,
    ...overrides,
  };
}

function confirmed(state: SafetyState): SafetyState {
  return { ...confirmStart({ state, tripId: 't1', remote: remote() }), queue: [] };
}

describe('startCheckIn', () => {
  it('shows the check-in at once and queues the start with clean gear', () => {
    const state = started();
    expect(state.active.t1).toMatchObject({
      id: 'ci1',
      contactNames: ['Mom'],
      expectedReturnAt: '2026-09-14T02:00:00.000Z',
      startedAt: now.toISOString(),
    });
    expect(state.queue).toEqual([
      {
        kind: 'start',
        tripId: 't1',
        checkInId: 'ci1',
        request: {
          id: 'ci1',
          contactIds: ['c1'],
          expectedReturnAt: '2026-09-14T02:00:00.000Z',
          graceMinutes: 120,
          identifyingGear: [{ name: 'tent', note: 'orange' }],
          trackingEnabled: false,
          startedAt: now.toISOString(),
          timeZone: 'America/Los_Angeles',
        },
      },
    ]);
  });
});

describe('recordCheckIn', () => {
  it('queues the position with a trimmed note and place', () => {
    const state = recordCheckIn({ state: started(), tripId: 't1', id: 'l1', fix, note: ' ok ' });
    expect(state.active.t1?.lastCheckInAt).toBe('2026-09-12T18:00:00.000Z');
    expect(state.queue.at(-1)).toEqual({
      kind: 'locations',
      checkInId: 'ci1',
      locations: [
        {
          id: 'l1',
          kind: 'check_in',
          latitude: 47.5,
          longitude: -120.8,
          accuracyMeters: 12,
          placeName: 'Colchuck Lake',
          note: 'ok',
          recordedAt: '2026-09-12T18:00:00.000Z',
        },
      ],
    });
  });

  it('stores a blank note as none', () => {
    const state = recordCheckIn({
      state: started(),
      tripId: 't1',
      id: 'l1',
      fix: { ...fix, placeName: null },
      note: '  ',
    });
    const last = state.queue.at(-1);
    expect(last?.kind === 'locations' && last.locations[0]).toMatchObject({
      note: null,
      placeName: null,
    });
  });

  it('ignores a trip with no check-in', () => {
    const state = started();
    expect(recordCheckIn({ state, tripId: 'other', id: 'l1', fix })).toBe(state);
  });
});

describe('recordTrackPoints', () => {
  it('queues track points only for check-ins that allowed tracking', () => {
    let n = 0;
    const tracking = recordTrackPoints({
      state: started({ tracking: true }),
      fixes: [fix],
      makeId: () => `p${++n}`,
    });
    expect(tracking.queue.at(-1)).toMatchObject({
      kind: 'locations',
      checkInId: 'ci1',
      locations: [{ id: 'p1', kind: 'track', placeName: null, note: null }],
    });

    const notTracking = started();
    expect(recordTrackPoints({ state: notTracking, fixes: [fix], makeId: () => 'x' })).toBe(
      notTracking,
    );
  });

  it('does nothing with no fixes', () => {
    const state = started({ tracking: true });
    expect(recordTrackPoints({ state, fixes: [], makeId: () => 'x' })).toBe(state);
  });
});

describe('extendCheckIn', () => {
  it('moves the return time and queues it', () => {
    const later = new Date('2026-09-14T05:00:00.000Z');
    const { state, checkIn } = extendCheckIn({
      state: started(),
      tripId: 't1',
      expectedReturnAt: later,
    });
    expect(checkIn?.expectedReturnAt).toBe(later.toISOString());
    expect(state.queue.at(-1)).toEqual({
      kind: 'extend',
      checkInId: 'ci1',
      expectedReturnAt: later.toISOString(),
    });
  });

  it('ignores a trip with no check-in', () => {
    const state = started();
    expect(extendCheckIn({ state, tripId: 'x', expectedReturnAt: now })).toEqual({
      state,
      checkIn: null,
    });
  });
});

describe('endCheckIn', () => {
  it('drops unsent track points but keeps manual check-ins, then queues the end', () => {
    let state = confirmed(started({ tracking: true }));
    state = recordTrackPoints({ state, fixes: [fix], makeId: () => 'p1' });
    state = recordCheckIn({ state, tripId: 't1', id: 'l1', fix });
    const result = endCheckIn({ state, tripId: 't1', outcome: 'safe', endedAt: now });
    expect(result.ended?.id).toBe('ci1');
    expect(result.state.active).toEqual({});
    expect(result.state.queue.map((op) => op.kind)).toEqual(['locations', 'end']);
    expect(result.state.queue.at(-1)).toEqual({
      kind: 'end',
      checkInId: 'ci1',
      outcome: 'safe',
      endedAt: now.toISOString(),
    });
  });

  it('queues an end behind a start still waiting for signal', () => {
    const result = endCheckIn({ state: started(), tripId: 't1', outcome: 'cancel', endedAt: now });
    expect(result.state.queue.map((op) => op.kind)).toEqual(['start', 'end']);
  });

  it('sends nothing for a check-in the server never heard of', () => {
    const state = dropRefused({ state: started(), errorMessage: 'nope' });
    const result = endCheckIn({ state, tripId: 't1', outcome: 'cancel', endedAt: now });
    expect(result.state).toEqual({ ...state, active: {} });
  });

  it('ignores a trip with no check-in', () => {
    const state = started();
    expect(endCheckIn({ state, tripId: 'x', outcome: 'safe', endedAt: now })).toEqual({
      state,
      ended: null,
    });
  });
});

describe('confirmStart', () => {
  it('records the share link and contact names from the server', () => {
    const state = confirmStart({ state: started(), tripId: 't1', remote: remote() });
    expect(state.active.t1).toMatchObject({
      shareUrl: 'https://api.example.com/api/safety/token',
      overdueAlertSent: false,
      startError: null,
    });
  });

  it('leaves a newer local check-in alone', () => {
    const state = started();
    expect(confirmStart({ state, tripId: 't1', remote: remote({ id: 'old' }) })).toBe(state);
  });
});

describe('reconcileRemote', () => {
  it('waits while this trip has writes queued', () => {
    const state = started();
    const result = reconcileRemote({ state, tripId: 't1', tripName: 'x', remote: null });
    expect(result).toEqual({ state, removed: null });
  });

  it('marks the overdue alert sent', () => {
    const state = confirmed(started());
    const result = reconcileRemote({
      state,
      tripId: 't1',
      tripName: 'Enchantments',
      remote: remote({ overdueAlertSentAt: '2026-09-14T04:00:00.000Z' }),
    });
    expect(result.state.active.t1?.overdueAlertSent).toBe(true);
  });

  it('picks up a check-in started on another device', () => {
    const result = reconcileRemote({
      state: EMPTY_SAFETY_STATE,
      tripId: 't1',
      tripName: 'Enchantments',
      remote: remote(),
    });
    expect(result.state.active.t1).toMatchObject({
      id: 'ci1',
      tripName: 'Enchantments',
      trackingEnabled: true,
      graceMinutes: 120,
      shareUrl: 'https://api.example.com/api/safety/token',
    });
  });

  it('drops a confirmed check-in that ended elsewhere', () => {
    const state = confirmed(started());
    const result = reconcileRemote({ state, tripId: 't1', tripName: 'x', remote: null });
    expect(result.state.active).toEqual({});
    expect(result.removed?.id).toBe('ci1');
  });

  it('keeps an unconfirmed check-in when the server has none', () => {
    const state = { ...started(), queue: [] };
    const result = reconcileRemote({ state, tripId: 't1', tripName: 'x', remote: null });
    expect(result).toEqual({ state, removed: null });
  });
});

describe('dropRefused', () => {
  it('drops a refused start with everything queued behind it and shows why', () => {
    let state = started();
    state = recordCheckIn({ state, tripId: 't1', id: 'l1', fix });
    state = dropRefused({ state, errorMessage: 'Trip not found' });
    expect(state.queue).toEqual([]);
    expect(state.active.t1?.startError).toBe('Trip not found');
  });

  it('drops any other refused write on its own', () => {
    let state = confirmed(started());
    state = recordCheckIn({ state, tripId: 't1', id: 'l1', fix });
    state = extendCheckIn({ state, tripId: 't1', expectedReturnAt: now }).state;
    state = dropRefused({ state, errorMessage: 'bad' });
    expect(state.queue.map((op) => op.kind)).toEqual(['extend']);
  });

  it('does nothing with an empty queue', () => {
    expect(dropRefused({ state: EMPTY_SAFETY_STATE, errorMessage: 'x' })).toBe(EMPTY_SAFETY_STATE);
  });

  it('leaves a newer check-in alone when an old start is refused', () => {
    const replaced: SafetyState = { ...started(), active: started({ id: 'ci2' }).active };
    expect(dropRefused({ state: replaced, errorMessage: 'x' }).active.t1?.startError).toBe(
      undefined,
    );
  });
});

describe('queue helpers', () => {
  it.each([
    [undefined, true],
    [null, true],
    [408, true],
    [429, true],
    [503, true],
    [400, false],
    [403, false],
    [404, false],
  ])('isRetryable(%s) is %s', (status, expected) => {
    expect(isRetryable(status)).toBe(expected);
  });

  it('counts writes waiting for this trip', () => {
    const state = recordCheckIn({ state: started(), tripId: 't1', id: 'l1', fix });
    expect(pendingCount({ state, tripId: 't1' })).toBe(2);
    expect(pendingCount({ state, tripId: 'other' })).toBe(0);
  });

  it('knows when any check-in is tracking', () => {
    expect(hasTrackingCheckIn(started())).toBe(false);
    expect(hasTrackingCheckIn(started({ tracking: true }))).toBe(true);
  });
});
