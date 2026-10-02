/**
 * Regression tests for idempotent pack creation, driven through the real route.
 *
 * `POST /packs` takes a client-supplied `id` and inserts it into `packs.id`, a
 * `text().primaryKey()`. The insert carried no conflict clause, so a create that
 * arrived twice raised a primary-key violation. The route's catch turned that into a
 * 500, and `OutboxService.classify` on the client treats 5xx as a retryable transport
 * failure — so the replay burned all five attempts and then marked the write
 * permanently failed, surfacing the red "changes couldn't be saved" banner.
 *
 * Duplicates are not hypothetical here: the offline outbox replays queued writes, and
 * the Expo carryover import queued a create for every record it read — which is how a
 * signed-in user's first launch of the Swift build produced "210 changes waiting to
 * sync" for packs the server already owned.
 *
 * The fix adds `onConflictDoNothing({ target: packs.id })` and, when the insert is a
 * no-op, re-reads the caller's own pack so the replay is idempotent. The re-read is
 * scoped by `userId` so a guessed id can neither overwrite nor disclose another user's
 * pack — that case gets a 409, which the client already treats as success on create.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

const EXISTING_ID = 'pack-already-on-server';
const OWNER_ID = 'user-1';

/** Rows the fake database holds, keyed by `id`. */
type Row = Record<string, unknown> & { id: string; userId: string };
const rows = new Map<string, Row>();

/** The columns `PackWithWeightsSchema` requires beyond what the insert supplies. */
const packColumnDefaults = {
  description: null,
  image: null,
  tags: null,
  deleted: false,
  isAIGenerated: false,
  isPublic: false,
  category: 'hiking',
  createdAt: new Date('2026-08-01T00:00:00.000Z'),
  updatedAt: new Date('2026-08-01T00:00:00.000Z'),
  localCreatedAt: new Date('2026-08-01T00:00:00.000Z'),
  localUpdatedAt: new Date('2026-08-01T00:00:00.000Z'),
} as const;

const mocks = vi.hoisted(() => ({
  onConflictDoNothing: vi.fn(),
  authenticatedUserId: { current: 'user-1' },
}));

vi.mock('@packrat/api/db', () => ({
  createDb: () => {
    const db = {
      tag: (_label: string) => db,
      insert: (_table: unknown) => ({
        values: (values: Row) => ({
          // No conflict clause would mean a unique violation here; the route must go
          // through `onConflictDoNothing` instead, so this path is deliberately absent.
          onConflictDoNothing: (args: unknown) => {
            mocks.onConflictDoNothing(args);
            return {
              // Postgres returns no row when the conflict target already exists.
              returning: async () => {
                if (rows.has(values.id)) return [];
                const row = { ...packColumnDefaults, ...values };
                rows.set(values.id, row);
                return [row];
              },
            };
          },
        }),
      }),
      query: {
        packs: {
          findFirst: async (args: { where: Record<string, string | undefined> }) => {
            // `eq` below keys the clause by the real column name, so `userId` arrives
            // as its snake_case column, `user_id`.
            const { id, user_id: userId } = args.where;
            if (!id || !userId) return undefined;
            const row = rows.get(id);
            if (!row || row.userId !== userId) return undefined;
            return { ...row, items: [] };
          },
        },
      },
    };
    return db;
  },
}));

// `and`/`eq` are only used to build the where clause the fake `findFirst` reads back.
vi.mock('drizzle-orm', async (importOriginal) => {
  const actual = await importOriginal<Record<string, unknown>>();
  return {
    ...actual,
    and: (...conds: Array<Record<string, unknown>>) => Object.assign({}, ...conds),
    eq: (col: { name?: string }, val: unknown) => ({ [col?.name ?? 'unknown']: val }),
  };
});

// Authenticate every request as `authenticatedUserId` without standing up Better Auth.
vi.mock('@packrat/api/middleware/auth', async () => {
  const { Elysia } = await import('elysia');
  const plugin = new Elysia({ name: 'authPlugin' })
    .derive(() => ({
      user: { userId: mocks.authenticatedUserId.current, role: 'USER', email: 't@test.com' },
    }))
    .macro({ isAuthenticated: () => ({}), isAdmin: () => ({}) })
    .as('scoped');
  return { authPlugin: plugin, adminAuthPlugin: plugin };
});

// Keep the route's catch silent; these tests assert on status codes, not reports.
vi.mock('@packrat/api/utils/sentry', () => ({
  captureApiException: () => {},
  apiAddBreadcrumb: () => {},
  record: async (_o: unknown, fn: () => unknown) => fn(),
}));

const { packsRoutes } = await import('@packrat/api/routes/packs');

function post(body: Record<string, unknown>) {
  return packsRoutes.handle(
    new Request('http://localhost/packs', {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: 'Bearer test' },
      body: JSON.stringify(body),
    }),
  );
}

function newPackBody(overrides: Record<string, unknown> = {}) {
  const now = new Date().toISOString();
  return {
    id: EXISTING_ID,
    name: 'Server Owned Pack',
    category: 'hiking',
    isPublic: false,
    localCreatedAt: now,
    localUpdatedAt: now,
    ...overrides,
  };
}

describe('POST /packs idempotency', () => {
  beforeEach(() => {
    rows.clear();
    vi.clearAllMocks();
    mocks.authenticatedUserId.current = OWNER_ID;
    rows.set(EXISTING_ID, {
      ...packColumnDefaults,
      id: EXISTING_ID,
      userId: OWNER_ID,
      name: 'Server Owned Pack',
    });
  });

  it('uses a conflict clause so a duplicate id cannot raise a primary-key violation', async () => {
    await post(newPackBody());

    expect(mocks.onConflictDoNothing).toHaveBeenCalledTimes(1);
  });

  it('returns the existing pack instead of 500 when the owner replays a create', async () => {
    const res = await post(newPackBody());

    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ id: EXISTING_ID, name: 'Server Owned Pack' });
  });

  it('still creates a pack whose id is genuinely new', async () => {
    const res = await post(newPackBody({ id: 'brand-new-pack', name: 'Fresh' }));

    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ id: 'brand-new-pack', name: 'Fresh' });
    expect(rows.has('brand-new-pack')).toBe(true);
  });

  it('does not disclose or overwrite a pack belonging to another user', async () => {
    mocks.authenticatedUserId.current = 'user-2';

    const res = await post(newPackBody({ name: 'Hijack' }));

    // 409 rather than the owner's row: the outbox treats 409-on-create as success, so
    // the write stops replaying without the caller learning anything about the pack.
    expect(res.status).toBe(409);
    expect(rows.get(EXISTING_ID)).toMatchObject({ userId: OWNER_ID, name: 'Server Owned Pack' });
  });
});
