import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  labels: [] as string[],
  calls: [] as Array<{ method: string; args: unknown[] }>,
  rows: [] as unknown[],
}));

vi.mock('@packrat/api/db', () => ({
  createDb: () => ({
    tag: (label: string) => {
      mocks.labels.push(label);
      const chain: object = new Proxy(
        {},
        {
          get(_target, prop) {
            if (prop === 'then') return (resolve: (v: unknown) => void) => resolve(mocks.rows);
            return (...args: unknown[]) => {
              mocks.calls.push({ method: String(prop), args });
              return chain;
            };
          },
        },
      );
      return chain;
    },
  }),
}));

import { createDb } from '@packrat/api/db';
import type { SQL } from 'drizzle-orm';
import { PgDialect } from 'drizzle-orm/pg-core';
import { firstNameOf, reportAuthorNames } from '../reportAuthors';

describe('firstNameOf', () => {
  it('uses the first name when the user has one', () => {
    expect(firstNameOf({ firstName: ' Sam ', name: 'Samantha Rivera' })).toBe('Sam');
  });

  it('falls back to the first word of the full name', () => {
    expect(firstNameOf({ firstName: null, name: '  Alex   Kim ' })).toBe('Alex');
  });

  it('treats a blank first name as missing', () => {
    expect(firstNameOf({ firstName: '  ', name: 'Jo Park' })).toBe('Jo');
  });

  it('is null when there is no name at all', () => {
    expect(firstNameOf({ firstName: null, name: '   ' })).toBeNull();
  });
});

describe('reportAuthorNames', () => {
  const db = createDb();

  beforeEach(() => {
    mocks.labels.length = 0;
    mocks.calls.length = 0;
    mocks.rows = [];
  });

  it('skips the query when there are no users to look up', async () => {
    expect(await reportAuthorNames({ db, userIds: [] })).toEqual(new Map());
    expect(mocks.labels).toEqual([]);
  });

  it('maps each author to their first name, looking each id up once', async () => {
    mocks.rows = [
      { id: 'u1', firstName: 'Sam', name: 'Samantha Rivera' },
      { id: 'u2', firstName: null, name: '   ' },
    ];

    const names = await reportAuthorNames({ db, userIds: ['u1', 'u2', 'u1'] });

    expect(names).toEqual(
      new Map([
        ['u1', 'Sam'],
        ['u2', null],
      ]),
    );
    expect(mocks.labels).toEqual(['trailConditions.authors']);
    const where = mocks.calls.find((c) => c.method === 'where')?.args[0] as SQL;
    expect(new PgDialect().sqlToQuery(where).params).toEqual(['u1', 'u2']);
  });
});
