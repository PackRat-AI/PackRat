import { PgDialect } from 'drizzle-orm/pg-core';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// Capture the Drizzle chain rather than hitting Postgres. What matters here is
// *what the query asks for* — the scoping predicates and the row cap — so the
// condition is rendered to real SQL and asserted on directly.
// The builder args are typed explicitly: `vi.fn(() => …)` infers a zero-arg
// signature, which types `mock.calls` as `[]` and makes `calls[0]?.[0]` a
// compile error rather than the captured argument.
const mockLimit = vi.fn((_count: number) => Promise.resolve<unknown[]>([]));
const mockWhere = vi.fn((_condition: unknown) => ({ limit: mockLimit }));
const mockFrom = vi.fn((_table: unknown) => ({ where: mockWhere }));
const mockSelect = vi.fn((_projection: Record<string, unknown>) => ({ from: mockFrom }));
const mockTag = vi.fn((_tag: string) => ({ select: mockSelect }));

vi.mock('@packrat/api/db', () => ({
  createDb: () => ({ tag: mockTag }),
}));

const { listUserPacksAiTool } = await import('../listUserPacksAiTool');

const TEST_USER_ID = 'user-1';

/** The `where` condition of the last call, rendered to SQL text + bound params. */
function lastWhere(): { sql: string; params: unknown[] } {
  const condition = mockWhere.mock.calls.at(-1)?.[0];
  const query = new PgDialect().sqlToQuery(condition as never);
  return { sql: query.sql, params: query.params };
}

describe('listUserPacksAiTool', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockLimit.mockResolvedValue([]);
  });

  it('returns the projected packs for the user', async () => {
    const rows = [
      { id: 'p1', name: 'Japan Trip', category: 'custom', description: 'City travel' },
      { id: 'p2', name: 'JMT 2026', category: 'backpacking', description: null },
    ];
    mockLimit.mockResolvedValueOnce(rows);

    await expect(listUserPacksAiTool({ userId: TEST_USER_ID })).resolves.toEqual(rows);
  });

  it('projects only the four columns the model needs', async () => {
    await listUserPacksAiTool({ userId: TEST_USER_ID });

    const projection = mockSelect.mock.calls[0]?.[0] ?? {};
    expect(Object.keys(projection).sort()).toEqual(['category', 'description', 'id', 'name']);
  });

  it('scopes to the signed-in user and excludes soft-deleted packs', async () => {
    await listUserPacksAiTool({ userId: TEST_USER_ID });

    // Both predicates are load-bearing: without the first the tool would leak
    // other users' packs, without the second it would resurrect deleted ones.
    const { sql, params } = lastWhere();
    expect(sql).toBe('("packs"."user_id" = $1 and "packs"."deleted" = $2)');
    expect(params).toEqual([TEST_USER_ID, false]);
  });

  it('adds a case-insensitive name filter when nameQuery is given', async () => {
    await listUserPacksAiTool({ userId: TEST_USER_ID, nameQuery: 'Japan' });

    const { sql, params } = lastWhere();
    expect(sql).toBe(
      '("packs"."user_id" = $1 and "packs"."deleted" = $2 and "packs"."name" ilike $3)',
    );
    // Substring match, so "Japan" finds "Japan Trip"; ilike keeps it
    // case-insensitive, which is what makes a name the model was given usable.
    expect(params).toEqual([TEST_USER_ID, false, '%Japan%']);
  });

  it('keeps the user scope when a name filter is applied', async () => {
    await listUserPacksAiTool({ userId: TEST_USER_ID, nameQuery: 'Japan' });

    // A name filter must never widen the scope to other users' packs.
    expect(lastWhere().params).toContain(TEST_USER_ID);
  });

  it('omits the name filter when nameQuery is absent', async () => {
    await listUserPacksAiTool({ userId: TEST_USER_ID });

    expect(lastWhere().sql).not.toContain('ilike');
  });

  it('treats an empty nameQuery as no filter', async () => {
    await listUserPacksAiTool({ userId: TEST_USER_ID, nameQuery: '' });

    // An empty string would otherwise become `ilike '%%'` — harmless, but the
    // unfiltered list is the honest query.
    expect(lastWhere().sql).not.toContain('ilike');
  });

  it('caps the row count so a pack list cannot flood the model context', async () => {
    await listUserPacksAiTool({ userId: TEST_USER_ID });

    expect(mockLimit).toHaveBeenCalledWith(50);
  });
});
