/**
 * Unit tests for the duplicate-pack route handler.
 *
 * The handler lives in ../pack.ts. We test it by importing packRoutes and
 * wrapping it in a thin Hono app with a fake auth middleware so we can
 * exercise the handler logic without spinning up a real HTTP server or DB.
 */
import { Hono } from 'hono';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// ---------------------------------------------------------------------------
// Mock the database module so no real DB connection is made
// ---------------------------------------------------------------------------
const mockFindFirst = vi.fn();
const mockTxInsert = vi.fn();
const mockTxFindFirst = vi.fn();
const mockTransaction = vi.fn();

vi.mock('@packrat/api/db', () => ({
  createDb: vi.fn(() => ({
    query: {
      packs: {
        findFirst: mockFindFirst,
      },
    },
    transaction: mockTransaction,
  })),
}));

// ---------------------------------------------------------------------------
// Mock drizzle-orm operators (they just need to be callable)
// ---------------------------------------------------------------------------
vi.mock('drizzle-orm', () => ({
  and: vi.fn((...args: unknown[]) => args),
  cosineDistance: vi.fn(),
  desc: vi.fn(),
  eq: vi.fn((col: unknown, val: unknown) => ({ col, val })),
  gt: vi.fn(),
  notInArray: vi.fn(),
  sql: vi.fn(),
}));

// ---------------------------------------------------------------------------
// Mock the DB schema (only the tables used by the duplicate handler)
// ---------------------------------------------------------------------------
vi.mock('@packrat/api/db/schema', () => ({
  packs: { id: 'id', userId: 'userId', isPublic: 'isPublic', deleted: 'deleted' },
  packItems: { deleted: 'deleted', packId: 'packId' },
  catalogItems: {},
  packWeightHistory: {},
}));

// ---------------------------------------------------------------------------
// Mock ancillary modules not relevant to the duplicate handler
// ---------------------------------------------------------------------------
vi.mock('@packrat/api/schemas/catalog', () => ({
  ErrorResponseSchema: {},
}));
vi.mock('@packrat/api/schemas/packs', () => ({
  GapAnalysisRequestSchema: {},
  GapAnalysisResponseSchema: {},
  PackWithWeightsSchema: {},
  UpdatePackRequestSchema: {},
}));
vi.mock('@packrat/api/utils/compute-pack', () => ({
  computePackWeights: vi.fn((pack: unknown) => ({
    ...(pack as object),
    totalWeight: 0,
    baseWeight: 0,
  })),
}));
vi.mock('@packrat/api/utils/DbUtils', () => ({
  getPackDetails: vi.fn(),
}));
vi.mock('@packrat/api/utils/env-validation', () => ({
  getEnv: vi.fn(() => ({ NEON_DATABASE_URL: 'postgres://localhost/test' })),
}));

// ---------------------------------------------------------------------------
// Import packRoutes AFTER all vi.mock() hoisting is complete
// ---------------------------------------------------------------------------
import { packRoutes } from '../pack';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Minimal pack row that satisfies the handler logic */
function makeSourcePack(overrides: Record<string, unknown> = {}) {
  return {
    id: 'pack-abc',
    name: 'Trail Pack',
    description: 'A pack',
    category: 'hiking',
    userId: 42, // owner user id
    isPublic: false,
    deleted: false,
    image: null,
    tags: [],
    templateId: null,
    isAIGenerated: false,
    localCreatedAt: new Date(),
    localUpdatedAt: new Date(),
    createdAt: new Date(),
    updatedAt: new Date(),
    items: [],
    ...overrides,
  };
}

/** Build a Hono app that injects the given userId into the context and routes to packRoutes */
function buildApp(userId: number) {
  const a = new Hono();
  a.use('*', async (c, next) => {
    c.set('user' as never, { userId } as never);
    await next();
  });
  a.route('/', packRoutes);
  return a;
}

/** Call the duplicate endpoint and return the response */
async function callDuplicate(
  packId: string,
  userId: number,
  body: Record<string, unknown> = {},
) {
  const a = buildApp(userId);
  const req = new Request(`http://localhost/${packId}/duplicate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  return a.fetch(req);
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------
describe('POST /{packId}/duplicate', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    // Default transaction: calls the callback and returns what the callback returns
    mockTransaction.mockImplementation(async (cb: (tx: unknown) => Promise<unknown>) => {
      const tx = {
        insert: mockTxInsert,
        query: {
          packs: { findFirst: mockTxFindFirst },
        },
      };
      return cb(tx);
    });

    // Default tx insert: chainable .values() that succeeds
    mockTxInsert.mockReturnValue({ values: vi.fn().mockResolvedValue([]) });
  });

  // -------------------------------------------------------------------------
  // Auth & visibility enforcement
  // -------------------------------------------------------------------------

  it('returns 403 when the pack is private and the requesting user is not the owner', async () => {
    mockFindFirst.mockResolvedValue(
      makeSourcePack({ userId: 99, isPublic: false }), // owned by user 99
    );

    const res = await callDuplicate('pack-abc', 1 /* requesting as user 1 */);
    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body).toMatchObject({ error: 'Forbidden' });
  });

  it('returns 404 when the pack does not exist', async () => {
    mockFindFirst.mockResolvedValue(undefined);

    const res = await callDuplicate('no-such-pack', 1);
    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body).toMatchObject({ error: 'Pack not found' });
  });

  it('returns 404 when the pack is soft-deleted', async () => {
    mockFindFirst.mockResolvedValue(
      makeSourcePack({ userId: 1, deleted: true }),
    );

    const res = await callDuplicate('pack-abc', 1);
    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body).toMatchObject({ error: 'Pack not found' });
  });

  // -------------------------------------------------------------------------
  // Successful duplication
  // -------------------------------------------------------------------------

  it('succeeds when the pack is public and the requesting user is not the owner', async () => {
    const publicPack = makeSourcePack({ userId: 99, isPublic: true });
    mockFindFirst.mockResolvedValue(publicPack);

    const duplicatedPack = {
      ...publicPack,
      id: 'p_new',
      userId: 1,
      isPublic: false,
      items: [],
    };
    mockTxFindFirst.mockResolvedValue(duplicatedPack);

    const res = await callDuplicate('pack-abc', 1 /* non-owner */);
    expect(res.status).toBe(200);
  });

  it('succeeds when the requesting user owns the private pack', async () => {
    const ownedPack = makeSourcePack({ userId: 1, isPublic: false });
    mockFindFirst.mockResolvedValue(ownedPack);

    const duplicatedPack = { ...ownedPack, id: 'p_new', items: [] };
    mockTxFindFirst.mockResolvedValue(duplicatedPack);

    const res = await callDuplicate('pack-abc', 1);
    expect(res.status).toBe(200);
  });

  // -------------------------------------------------------------------------
  // UUID format
  // -------------------------------------------------------------------------

  it('generates UUIDs (36-char hex+dash format) for new pack and item IDs', async () => {
    const sourcePack = makeSourcePack({
      userId: 1,
      items: [
        {
          id: 'pi_old',
          name: 'Tent',
          description: null,
          weight: 1200,
          weightUnit: 'g',
          quantity: 1,
          category: 'shelter',
          consumable: false,
          worn: false,
          image: null,
          notes: null,
          catalogItemId: null,
          userId: 1,
          deleted: false,
          isAIGenerated: false,
          templateItemId: null,
          embedding: null,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ],
    });
    mockFindFirst.mockResolvedValue(sourcePack);

    // Capture the IDs passed to tx.insert(...).values(...)
    let capturedPackId: string | undefined;
    let capturedItemId: string | undefined;

    mockTxInsert.mockImplementation(() => ({
      values: vi.fn(
        async (data: Record<string, unknown> | Array<Record<string, unknown>>) => {
          if (Array.isArray(data)) {
            capturedItemId = data[0]?.id as string;
          } else {
            capturedPackId = data.id as string;
          }
          return [];
        },
      ),
    }));

    const duplicatedPack = { ...sourcePack, id: 'p_new', items: [] };
    mockTxFindFirst.mockResolvedValue(duplicatedPack);

    const res = await callDuplicate('pack-abc', 1);
    expect(res.status).toBe(200);

    // Pack ID: "p_<uuid>"
    expect(capturedPackId).toBeDefined();
    const packUuidPart = capturedPackId!.replace(/^p_/, '');
    expect(packUuidPart).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/,
    );

    // Item ID: "pi_<uuid>"
    expect(capturedItemId).toBeDefined();
    const itemUuidPart = capturedItemId!.replace(/^pi_/, '');
    expect(itemUuidPart).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/,
    );
  });

  // -------------------------------------------------------------------------
  // Transaction rollback
  // -------------------------------------------------------------------------

  it('returns 500 and does not succeed when item insertion fails (simulating transaction rollback)', async () => {
    const sourcePack = makeSourcePack({
      userId: 1,
      items: [
        {
          id: 'pi_old',
          name: 'Sleeping Bag',
          description: null,
          weight: 800,
          weightUnit: 'g',
          quantity: 1,
          category: 'sleep',
          consumable: false,
          worn: false,
          image: null,
          notes: null,
          catalogItemId: null,
          userId: 1,
          deleted: false,
          isAIGenerated: false,
          templateItemId: null,
          embedding: null,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ],
    });
    mockFindFirst.mockResolvedValue(sourcePack);

    // Simulate: pack insert succeeds, item insert throws a DB error
    let insertCallCount = 0;
    mockTxInsert.mockImplementation(() => ({
      values: vi.fn(async () => {
        insertCallCount++;
        if (insertCallCount === 2) {
          // Second insert (items) throws — triggering a rollback in a real DB
          throw new Error('DB constraint violation');
        }
        return [];
      }),
    }));

    // Make the transaction propagate the error (simulating rollback by the DB driver)
    mockTransaction.mockImplementation(async (cb: (tx: unknown) => Promise<unknown>) => {
      const tx = {
        insert: mockTxInsert,
        query: { packs: { findFirst: mockTxFindFirst } },
      };
      return cb(tx); // Error from cb propagates; no commit happens
    });

    const res = await callDuplicate('pack-abc', 1);

    // The route should catch the transaction error and return 500
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body).toMatchObject({ error: 'Failed to duplicate pack' });
  });
});
