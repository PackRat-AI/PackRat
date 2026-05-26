/**
 * Dev DB seeder — realistic fake data for local development + QA.
 *
 * Run:
 *   cd packages/api
 *   NEON_DATABASE_URL=postgres://test_user:test_password@localhost:5432/packrat_test \
 *     bun run db:seed:dev
 *
 * Use case: new devs hitting a fresh DB, QA wanting realistic pagination /
 * empty-vs-populated state, perf-at-scale smoke. Uses `drizzle-seed`'s
 * reproducible-randomness via a fixed numeric seed so re-runs produce the
 * same data; pair with `reset()` if you want a clean re-seed.
 *
 * NOT for production. The script HARD-refuses to run against a Neon-hosted
 * URL (no override flag) — drizzle-seed expects to TRUNCATE tables and a
 * stray prod run would wipe real user data. The 3 prod-config
 * seeds (`seed.ts`, `seed-e2e-user.ts`, `seed-claude-oauth-client.ts`) are
 * the correct path for production-row management — they use plain
 * `db.insert()` with idempotency checks, not drizzle-seed.
 *
 * Tables seeded:
 *   - users (50)
 *   - packs (each user gets 2-5)
 *   - packItems (each pack gets 8-20)
 *   - catalogItems (100, independent)
 *   - posts (each user gets 0-3)
 *   - postComments (each post gets 0-5)
 *
 * Tables explicitly NOT seeded:
 *   - session/account/verification/jwks — Better Auth manages these; faking
 *     them would create unusable sessions (no real auth credentials)
 *   - oauth* — handled by `seed-claude-oauth-client.ts` (deterministic config)
 *   - packTemplates/packTemplateItems — handled by `seed.ts` (Featured Packs)
 *   - postLikes/commentLikes — unique (postId,userId) constraint is hard to
 *     satisfy with random nested generation; revisit if needed
 *   - trips/trailConditionReports — depend on OSM data not present locally
 *   - reportedContent/invalidItemLogs/etlJobs — rare admin paths
 */

import { neon, neonConfig } from '@neondatabase/serverless';
import * as schema from '@packrat/db/schema';
import { nodeEnv } from '@packrat/env/node';
import { drizzle, type NeonHttpDatabase } from 'drizzle-orm/neon-http';
import { drizzle as drizzlePg, type NodePgDatabase } from 'drizzle-orm/node-postgres';
import { seed } from 'drizzle-seed';
import { Client } from 'pg';
import WebSocket from 'ws';

neonConfig.webSocketConstructor = WebSocket;

// Fixed numeric seed → reproducible randomness across runs.
const SEED = 42;

// ── Outdoor-domain word lists for realistic content ──────────────────────

const PACK_NAME_REGIONS = [
  'Yosemite',
  'Patagonia',
  'PCT Section',
  'Alps Traverse',
  'Glacier NP',
  'Zion Narrows',
  'Joshua Tree',
  'Acadia Loop',
  'Olympic Coast',
  'Big Sur',
  'Sawtooth',
  'Wind River',
  'High Sierra',
  'White Mountains',
  'Cascades',
];
const PACK_NAME_FORMS = [
  '3-day',
  'Weekend',
  'Thru-Hike',
  'Day Trip',
  'Overnight',
  'Winter Edition',
  'Summer Loop',
  'Spring Trek',
  'Solo',
  'With Kids',
  'Ultralight',
  'Fastpack',
];

const ITEM_NAMES = [
  'Backpack',
  'Tent',
  'Sleeping Bag',
  'Sleeping Pad',
  'Headlamp',
  'Stove',
  'Water Filter',
  'Trekking Poles',
  'Rain Jacket',
  'Down Jacket',
  'Base Layer Top',
  'Base Layer Bottom',
  'Hiking Boots',
  'Trail Runners',
  'Camp Shoes',
  'First Aid Kit',
  'Map',
  'Compass',
  'Whistle',
  'Multi-tool',
  'Pocket Knife',
  'Cooking Pot',
  'Spork',
  'Insulated Mug',
  'Water Bottle',
  'Hydration Bladder',
  'Sunscreen',
  'Bug Spray',
  'Toilet Paper',
  'Trowel',
  'Bear Canister',
  'Camera',
  'Power Bank',
  'Trail Mix',
  'Energy Bars',
  'Dehydrated Meal',
  'Beanie',
  'Sun Hat',
  'Gloves',
  'Buff',
];

const BRANDS = [
  'REI Co-op',
  'Patagonia',
  'The North Face',
  "Arc'teryx",
  'Black Diamond',
  'MSR',
  'Big Agnes',
  'Therm-a-Rest',
  'Osprey',
  'Gregory',
  'Salomon',
  'Merrell',
  'Smartwool',
  'Darn Tough',
  'Sea to Summit',
  'Petzl',
  'Garmin',
  'Hyperlite',
  'Zpacks',
  'Six Moon Designs',
];

const ITEM_CATEGORIES = [
  'clothing',
  'shelter',
  'sleep',
  'kitchen',
  'water',
  'electronics',
  'first-aid',
  'navigation',
  'tools',
  'consumables',
  'miscellaneous',
] as const;

const PACK_CATEGORIES = [
  'hiking',
  'backpacking',
  'camping',
  'climbing',
  'winter',
  'desert',
  'water sports',
  'skiing',
] as const;

const POST_CAPTIONS = [
  'Day 3 of the loop — weather was perfect.',
  'Switched to a smaller pack and dropped 8 lbs. Worth it.',
  'First night out with the new tent — held up in 30mph gusts.',
  'Anyone got beta on the upper traverse?',
  'Trip recap: 47 miles, 11k feet, no blisters.',
  'New ultralight setup ready for next weekend.',
  'Gear shakedown done — about to leave for the trailhead.',
  'Wildflowers are out, get up here.',
  'Lessons from a Type 2 weekend.',
  'My loadout for the upcoming thru-hike.',
];

// ── Safety guard ────────────────────────────────────────────────────────

function assertNotProduction(dbUrl: string): void {
  const host = (() => {
    try {
      return new URL(dbUrl).hostname.toLowerCase();
    } catch {
      return '';
    }
  })();
  const looksProd =
    host.endsWith('.neon.tech') ||
    host.endsWith('.neon.com') ||
    host === 'neon.tech' ||
    host === 'neon.com';
  if (looksProd) {
    throw new Error(
      `Refusing to seed-dev against a Neon-hosted URL (${host}). drizzle-seed ` +
        'TRUNCATEs tables before inserting, which would destroy production data. ' +
        'There is no override flag — point at a local/docker Postgres instead.',
    );
  }
}

const isStandardPostgresUrl = (url: string) => {
  try {
    const u = new URL(url);
    const host = u.hostname.toLowerCase();
    const isNeonTech = host === 'neon.tech' || host.endsWith('.neon.tech');
    const isNeonCom = host === 'neon.com' || host.endsWith('.neon.com');
    return u.protocol === 'postgres:' && !isNeonTech && !isNeonCom;
  } catch {
    return false;
  }
};

// ── Script body ─────────────────────────────────────────────────────────

async function seedDev(): Promise<void> {
  const dbUrl = nodeEnv.NEON_DATABASE_URL;
  if (!dbUrl) throw new Error('NEON_DATABASE_URL is required');

  assertNotProduction(dbUrl);

  type SeedDatabase = NodePgDatabase<typeof schema> | NeonHttpDatabase<typeof schema>;
  let db: SeedDatabase;
  let pgClient: Client | undefined;

  if (isStandardPostgresUrl(dbUrl)) {
    pgClient = new Client({ connectionString: dbUrl });
    await pgClient.connect();
    db = drizzlePg(pgClient, { schema });
  } else {
    db = drizzle(neon(dbUrl), { schema });
  }

  try {
    console.log('[seed-dev] Seeding with drizzle-seed (seed=42)...');

    // Scope: just the 6 core tables. We pass a SCHEMA SUBSET to seed() so
    // drizzle-seed doesn't try to TRUNCATE+populate Better Auth tables,
    // pgvector index columns, etc.
    const scoped = {
      users: schema.users,
      packs: schema.packs,
      packItems: schema.packItems,
      catalogItems: schema.catalogItems,
      posts: schema.posts,
      postComments: schema.postComments,
    };

    await seed(db, scoped, { seed: SEED }).refine((f) => ({
      users: {
        count: 50,
        columns: {
          id: f.uuid(),
          email: f.email(),
          name: f.fullName(),
          firstName: f.firstName(),
          lastName: f.lastName(),
          role: f.valuesFromArray({
            values: [
              { weight: 0.95, values: ['USER'] },
              { weight: 0.05, values: ['ADMIN'] },
            ],
          }),
          emailVerified: f.boolean(),
          // Avatar/image left as default (text nullable).
        },
      },

      packs: {
        count: 150, // ≈ 3 per user × 50 users
        columns: {
          id: f.uuid(),
          name: f.valuesFromArray({
            values: PACK_NAME_REGIONS.flatMap((r) => PACK_NAME_FORMS.map((s) => `${r} ${s}`)),
          }),
          description: f.loremIpsum({ sentencesCount: 2 }),
          category: f.valuesFromArray({ values: [...PACK_CATEGORIES] }),
          isPublic: f.valuesFromArray({
            values: [
              { weight: 0.7, values: [true] },
              { weight: 0.3, values: [false] },
            ],
          }),
          tags: f.default({ defaultValue: [] }),
          localCreatedAt: f.date({ minDate: '2024-01-01', maxDate: '2026-05-25' }),
          localUpdatedAt: f.date({ minDate: '2024-01-01', maxDate: '2026-05-25' }),
        },
      },

      packItems: {
        count: 1500, // ≈ 10 per pack × 150 packs
        columns: {
          id: f.uuid(),
          name: f.valuesFromArray({ values: ITEM_NAMES }),
          description: f.loremIpsum({ sentencesCount: 1 }),
          weight: f.number({ minValue: 10, maxValue: 2000, precision: 1 }),
          weightUnit: f.valuesFromArray({ values: ['g', 'oz'] }),
          quantity: f.int({ minValue: 1, maxValue: 4 }),
          category: f.valuesFromArray({ values: [...ITEM_CATEGORIES] }),
          consumable: f.valuesFromArray({
            values: [
              { weight: 0.85, values: [false] },
              { weight: 0.15, values: [true] },
            ],
          }),
          worn: f.valuesFromArray({
            values: [
              { weight: 0.8, values: [false] },
              { weight: 0.2, values: [true] },
            ],
          }),
          // embedding (pgvector) left as default null — drizzle-seed doesn't
          // know about vector columns and we don't need real embeddings for dev.
        },
      },

      catalogItems: {
        count: 100,
        columns: {
          name: f.valuesFromArray({ values: ITEM_NAMES }),
          productUrl: f.default({ defaultValue: 'https://example.com/product' }),
          sku: f.uuid(),
          weight: f.number({ minValue: 10, maxValue: 2000, precision: 1 }),
          weightUnit: f.valuesFromArray({ values: ['g', 'oz'] }),
          description: f.loremIpsum({ sentencesCount: 2 }),
          brand: f.valuesFromArray({ values: BRANDS }),
          price: f.number({ minValue: 10, maxValue: 800, precision: 2 }),
          categories: f.default({ defaultValue: ['gear'] }),
          images: f.default({ defaultValue: [] }),
        },
      },

      posts: {
        count: 80, // ≈ 1.6 per user
        columns: {
          caption: f.valuesFromArray({ values: POST_CAPTIONS }),
          images: f.default({ defaultValue: [] }),
        },
      },

      postComments: {
        count: 200, // ≈ 2.5 per post
        columns: {
          content: f.loremIpsum({ sentencesCount: 1 }),
          // parentCommentId left as default null — no nested-thread modeling here.
        },
      },
    }));

    console.log('[seed-dev] Done. Approximate counts:');
    console.log('             users:         50');
    console.log('             packs:        150');
    console.log('             packItems:   1500');
    console.log('             catalogItems: 100');
    console.log('             posts:         80');
    console.log('             postComments: 200');
  } finally {
    await pgClient?.end();
  }
}

seedDev().catch((err) => {
  console.error('[seed-dev] Failed:', err);
  process.exit(1);
});
