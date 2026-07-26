/**
 * Populate the MCP tester account (mcp.tester@packratai.com) with packs,
 * pack items, and weight history so the MCP connector exercise prompts have
 * real data to hit.
 *
 * Idempotent: on re-run it hard-deletes this user's previously-seeded packs
 * (by the `mcp-seed` tag) and their items, then recreates the fixture set.
 *
 * Data shape:
 *   - 4 packs across categories (backpacking / camping / winter / hiking)
 *   - 28 pack items total (> the 20-item inventory threshold that
 *     season-suggestions requires), a dozen linked to REAL embedded catalog
 *     items (so similar_* / suggest_pack_items have proper vector rows) and
 *     the rest custom.
 *   - weight-history points on two packs.
 *
 * Note on embeddings: pack_items get their `embedding` column populated
 * asynchronously by the API's embeddings queue when created THROUGH the API.
 * Seeding directly into the DB does not enqueue that work, so
 * packrat_similar_pack_items may return sparse results until a backfill runs.
 * The linked catalog items DO have embeddings, so packrat_similar_catalog_items
 * and packrat_suggest_pack_items (catalog-side) work immediately.
 *
 * Usage:
 *   NEON_DATABASE_URL=<url> bun run packages/api/src/db/seed-mcp-tester.ts
 */

import { neon, neonConfig } from '@neondatabase/serverless';
import * as schema from '@packrat/db/schema';
import { nodeEnv } from '@packrat/env/node';
import { and, eq, inArray } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/neon-http';
import WebSocket from 'ws';

neonConfig.webSocketConstructor = WebSocket;

const TESTER_EMAIL = 'mcp.tester@packratai.com';
const SEED_TAG = 'mcp-seed';

type ItemSpec = {
  name: string;
  category: string; // ItemCategory
  weight: number; // grams
  quantity?: number;
  consumable?: boolean;
  worn?: boolean;
  notes?: string;
  catalogItemId?: number; // real, embedded catalog row
};

type PackSpec = {
  name: string;
  description: string;
  category: string; // PackCategory
  tags: string[];
  items: ItemSpec[];
  weightHistory?: number[]; // grams, oldest → newest
};

// Real, embedded catalog item IDs discovered from the live catalog.
const CATALOG = {
  tent: 5951,
  sleepingBag: 611,
  sleepingPad: 6018,
  backpack: 1635,
  headlamp: 7466,
  stove: 6182,
  waterFilter: 6578,
  downJacket: 242,
  rainJacket: 257,
  trekkingPoles: 8109,
  firstAid: 134162,
  trailRunner: 90715,
} as const;

const PACKS: PackSpec[] = [
  {
    name: 'JMT Thru-Hike (Sierra)',
    description: 'Lightweight 3-season kit for a John Muir Trail section.',
    category: 'backpacking',
    tags: ['thru-hike', 'sierra', '3-season'],
    weightHistory: [8200, 7850, 7600],
    items: [
      {
        name: 'Fitz Roy 30°F Sleeping Bag',
        category: 'sleep',
        weight: 794,
        catalogItemId: CATALOG.sleepingBag,
      },
      {
        name: 'Therm-A-Rest ProLite Apex Pad',
        category: 'sleep',
        weight: 261,
        catalogItemId: CATALOG.sleepingPad,
      },
      {
        name: 'Ultralight Backpack 29L',
        category: 'miscellaneous',
        weight: 960,
        catalogItemId: CATALOG.backpack,
      },
      {
        name: 'LiteMax Titanium Stove',
        category: 'kitchen',
        weight: 54,
        catalogItemId: CATALOG.stove,
      },
      {
        name: 'LifeStraw Solo Water Filter',
        category: 'water',
        weight: 48,
        catalogItemId: CATALOG.waterFilter,
      },
      {
        name: 'Dinobryte Headlamp',
        category: 'electronics',
        weight: 118,
        catalogItemId: CATALOG.headlamp,
      },
      {
        name: 'AlpLight Down Jacket',
        category: 'clothing',
        weight: 217,
        worn: false,
        catalogItemId: CATALOG.downJacket,
      },
      {
        name: 'Granite Crest Rain Jacket',
        category: 'clothing',
        weight: 357,
        catalogItemId: CATALOG.rainJacket,
      },
      {
        name: 'Trail Runners',
        category: 'clothing',
        weight: 620,
        worn: true,
        catalogItemId: CATALOG.trailRunner,
      },
      {
        name: 'Freeze-dried dinners x4',
        category: 'consumables',
        weight: 680,
        quantity: 4,
        consumable: true,
      },
      { name: 'Bear canister', category: 'miscellaneous', weight: 1130 },
    ],
  },
  {
    name: 'Car Camping — Yosemite Valley',
    description: 'Comfort-first weekend car camp.',
    category: 'camping',
    tags: ['car-camping', 'family', 'weekend'],
    weightHistory: [15200, 15200],
    items: [
      { name: '4-Season Cot Tent', category: 'shelter', weight: 1361, catalogItemId: CATALOG.tent },
      { name: 'Camp chairs x2', category: 'miscellaneous', weight: 2400, quantity: 2 },
      { name: 'Two-burner stove', category: 'kitchen', weight: 4500 },
      { name: 'Cooler (soft)', category: 'kitchen', weight: 1800 },
      { name: 'Lantern', category: 'electronics', weight: 340 },
      { name: 'Sleeping bag (car)', category: 'sleep', weight: 1600 },
      { name: 'Firewood bundle', category: 'consumables', weight: 5000, consumable: true },
    ],
  },
  {
    name: 'Winter Overnight — Rainier',
    description: 'Snow-camp overnight, single push.',
    category: 'winter',
    tags: ['winter', 'snow', 'mountaineering'],
    items: [
      {
        name: 'Trekking / snow poles',
        category: 'tools',
        weight: 249,
        catalogItemId: CATALOG.trekkingPoles,
      },
      {
        name: 'First Aid & Repair Kit',
        category: 'first-aid',
        weight: 71,
        catalogItemId: CATALOG.firstAid,
      },
      { name: '0°F winter bag', category: 'sleep', weight: 1500 },
      { name: 'Insulated pad (R6)', category: 'sleep', weight: 700 },
      { name: 'Down parka', category: 'clothing', weight: 620 },
      {
        name: 'Melt snow — fuel canisters x2',
        category: 'consumables',
        weight: 460,
        quantity: 2,
        consumable: true,
      },
      { name: 'Goggles + balaclava', category: 'clothing', weight: 180 },
    ],
  },
  {
    name: 'Day Hike — Mission Peak',
    description: 'Fast-and-light day loop.',
    category: 'hiking',
    tags: ['day-hike', 'fastpacking'],
    items: [
      { name: 'Trail snacks', category: 'consumables', weight: 300, consumable: true },
      { name: '2L water', category: 'water', weight: 2000, consumable: true },
      { name: 'Sun hat', category: 'clothing', weight: 90, worn: true },
    ],
  },
];

async function main(): Promise<void> {
  const dbUrl = nodeEnv.NEON_DATABASE_URL;
  if (!dbUrl) throw new Error('NEON_DATABASE_URL is required');
  const db = drizzle(neon(dbUrl), { schema });

  const found = await db
    .select({ id: schema.users.id })
    .from(schema.users)
    .where(eq(schema.users.email, TESTER_EMAIL))
    .limit(1);
  const userId = found[0]?.id;
  if (!userId) {
    throw new Error(
      `User ${TESTER_EMAIL} not found. Seed the account first (e.g. db:seed:e2e-user with E2E_TEST_EMAIL=${TESTER_EMAIL}).`,
    );
  }
  console.log(`Tester user: ${TESTER_EMAIL} (id=${userId})`);

  // ── Idempotency: wipe previously seeded packs (by tag) + their items ──────
  const prior = await db
    .select({ id: schema.packs.id, tags: schema.packs.tags })
    .from(schema.packs)
    .where(eq(schema.packs.userId, userId));
  const priorSeeded = prior.filter((p) => (p.tags ?? []).includes(SEED_TAG)).map((p) => p.id);
  if (priorSeeded.length > 0) {
    await db.delete(schema.packItems).where(inArray(schema.packItems.packId, priorSeeded));
    await db
      .delete(schema.packWeightHistory)
      .where(inArray(schema.packWeightHistory.packId, priorSeeded));
    await db.delete(schema.packs).where(inArray(schema.packs.id, priorSeeded));
    console.log(`Cleared ${priorSeeded.length} previously-seeded pack(s).`);
  }

  const now = new Date();
  let totalItems = 0;

  for (const spec of PACKS) {
    const packId = crypto.randomUUID();
    await db.insert(schema.packs).values({
      id: packId,
      name: spec.name,
      description: spec.description,
      category: spec.category as (typeof schema.packs.$inferInsert)['category'],
      userId,
      isPublic: false,
      tags: [...spec.tags, SEED_TAG],
      localCreatedAt: now,
      localUpdatedAt: now,
    });

    const itemRows = spec.items.map((it) => ({
      id: crypto.randomUUID(),
      name: it.name,
      weight: it.weight,
      weightUnit: 'g' as const,
      quantity: it.quantity ?? 1,
      category: it.category,
      consumable: it.consumable ?? false,
      worn: it.worn ?? false,
      notes: it.notes ?? null,
      packId,
      catalogItemId: it.catalogItemId ?? null,
      userId,
    }));
    await db.insert(schema.packItems).values(itemRows);
    totalItems += itemRows.length;

    const history = spec.weightHistory ?? [];
    if (history.length > 0) {
      await db.insert(schema.packWeightHistory).values(
        history.map((w, i) => ({
          id: crypto.randomUUID(),
          userId,
          packId,
          weight: w,
          // space history points a day apart, oldest first
          localCreatedAt: new Date(now.getTime() - (history.length - i) * 86_400_000),
        })),
      );
    }

    console.log(
      `  + pack "${spec.name}" (${spec.category}) — ${itemRows.length} items` +
        (spec.weightHistory ? `, ${spec.weightHistory.length} weight points` : ''),
    );
  }

  // Verify the inventory threshold for season-suggestions.
  const inv = await db
    .select({ id: schema.packItems.id })
    .from(schema.packItems)
    .where(and(eq(schema.packItems.userId, userId), eq(schema.packItems.deleted, false)));
  console.log(
    `Done. ${PACKS.length} packs, ${totalItems} items seeded. ` +
      `Total non-deleted inventory items for user: ${inv.length} ` +
      `(season-suggestions needs >= 20 → ${inv.length >= 20 ? 'OK ✅' : 'STILL SHORT ❌'}).`,
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
