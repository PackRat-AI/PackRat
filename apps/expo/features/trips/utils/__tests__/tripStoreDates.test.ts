import { describe, expect, it } from 'vitest';
import { restoreTripDateStrings } from '../tripStoreDates';

describe('restoreTripDateStrings', () => {
  it('turns revived Date fields back into ISO strings', () => {
    const trips = {
      a: {
        id: 'a',
        name: 'Random',
        startDate: new Date('2026-10-01T00:00:00.000Z'),
        endDate: new Date('2026-10-04T00:00:00.000Z'),
      },
    };
    expect(restoreTripDateStrings(trips)).toEqual({
      a: {
        id: 'a',
        name: 'Random',
        startDate: '2026-10-01T00:00:00.000Z',
        endDate: '2026-10-04T00:00:00.000Z',
      },
    });
  });

  it('leaves string and missing dates alone', () => {
    const trips = { b: { id: 'b', startDate: '2026-10-01', endDate: null, log: { distance: 3 } } };
    expect(restoreTripDateStrings(trips)).toEqual({
      b: { id: 'b', startDate: '2026-10-01', endDate: null, log: { distance: 3 } },
    });
  });
});
