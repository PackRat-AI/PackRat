/**
 * Seed a handful of catalog items so the catalog-tab and catalog-search
 * Playwright tests have data to render and filter against. Idempotent on
 * SKU — re-running won't duplicate rows.
 *
 * Usage:
 *   NEON_DATABASE_URL=<url> OPENAI_API_KEY=<key> \
 *     bun run packages/api/src/db/seed-e2e-catalog.ts
 *
 * Why this script exists: in production the `catalog_items` table is
 * populated by the ETL workflow scraping product pages. Local dev DBs
 * (docker-compose.test.yml) start empty, so anything that scrolls the
 * catalog tab or runs a similarity search has nothing to find.
 */

import { neon, neonConfig } from '@neondatabase/serverless';
import * as schema from '@packrat/db/schema';
import { nodeEnv } from '@packrat/env/node';
import { drizzle, type NeonHttpDatabase } from 'drizzle-orm/neon-http';
import { drizzle as drizzlePg, type NodePgDatabase } from 'drizzle-orm/node-postgres';
import { Client } from 'pg';
import WebSocket from 'ws';

neonConfig.webSocketConstructor = WebSocket;

// Mirrors packages/api/src/db/index.ts so the seed script picks the same
// driver path as the runtime — pg for raw Postgres (postgres:// or
// postgresql://), neon-http for Neon and for the local db.localtest.me proxy
// (which speaks Neon's HTTP wire format despite the URL looking standard).
const isStandardPostgresUrl = (url: string) => {
  try {
    const u = new URL(url);
    const host = u.hostname.toLowerCase();
    const isNeonTech = host === 'neon.tech' || host.endsWith('.neon.tech');
    const isNeonCom = host === 'neon.com' || host.endsWith('.neon.com');
    const isLocalNeonProxy = host === 'db.localtest.me';
    return (
      (u.protocol === 'postgres:' || u.protocol === 'postgresql:') &&
      !isNeonTech &&
      !isNeonCom &&
      !isLocalNeonProxy
    );
  } catch {
    return false;
  }
};

type SeedItem = {
  sku: string;
  name: string;
  description: string;
  weight: number;
  weightUnit: 'g' | 'oz';
  categories: string[];
  brand?: string;
};

// A small, hand-picked set covering distinct gear categories so the catalog
// search test ("sleeping bag") and the add-from-catalog test (just needs at
// least one item) both have meaningful hits.
const ITEMS: SeedItem[] = [
  {
    sku: 'e2e-sleeping-bag-20f',
    name: 'Mountain Loft Down Sleeping Bag 20°F',
    description: 'Lightweight down sleeping bag rated to 20°F for 3-season backpacking.',
    weight: 980,
    weightUnit: 'g',
    categories: ['Sleep System'],
    brand: 'TrailLab',
  },
  {
    sku: 'e2e-sleeping-bag-30f',
    name: 'Sierra Lite Sleeping Bag 30°F',
    description: 'Compact synthetic sleeping bag for summer hiking.',
    weight: 720,
    weightUnit: 'g',
    categories: ['Sleep System'],
    brand: 'PackRat Gear',
  },
  {
    sku: 'e2e-tent-2p',
    name: 'Cascade 2P Backpacking Tent',
    description: 'Two-person freestanding tent, 1.6 kg packed weight, double-wall.',
    weight: 1600,
    weightUnit: 'g',
    categories: ['Shelter'],
    brand: 'TrailLab',
  },
  {
    sku: 'e2e-backpack-55l',
    name: '55L Hiking Backpack',
    description: 'Internal frame pack with hydration sleeve and rain cover.',
    weight: 1500,
    weightUnit: 'g',
    categories: ['Packs'],
    brand: 'PackRat Gear',
  },
  {
    sku: 'e2e-stove-canister',
    name: 'Spark Mini Canister Stove',
    description: 'Pocket-sized canister stove, boils 500ml in 3:30.',
    weight: 78,
    weightUnit: 'g',
    categories: ['Cooking'],
  },
  {
    sku: 'e2e-headlamp',
    name: 'Beam 350 Headlamp',
    description: 'Rechargeable 350-lumen headlamp with red-light mode.',
    weight: 68,
    weightUnit: 'g',
    categories: ['Lighting'],
  },
  {
    sku: 'e2e-water-filter',
    name: 'Squeeze Water Filter',
    description: 'Hollow-fiber filter that removes 99.99% of bacteria and protozoa.',
    weight: 90,
    weightUnit: 'g',
    categories: ['Water'],
  },
  {
    sku: 'e2e-rain-jacket',
    name: 'Stormshield Rain Jacket',
    description: 'Three-layer waterproof breathable shell with pit zips.',
    weight: 320,
    weightUnit: 'g',
    categories: ['Apparel'],
  },
  {
    sku: 'e2e-puffy',
    name: 'Featherlite 800-Fill Down Jacket',
    description: 'Insulated puffy jacket for cold belays and camp wear.',
    weight: 290,
    weightUnit: 'g',
    categories: ['Apparel'],
    brand: 'PackRat Gear',
  },
  {
    sku: 'e2e-sleeping-pad',
    name: 'Aircell Insulated Sleeping Pad',
    description: 'R-value 4.2 inflatable sleeping pad, 460 g packed.',
    weight: 460,
    weightUnit: 'g',
    categories: ['Sleep System'],
  },
];

async function embedAll(opts: { values: string[]; openAiKey: string }): Promise<number[][]> {
  const { values, openAiKey } = opts;
  if (openAiKey.startsWith('sk-e2e-stub-')) {
    return values.map((value) => {
      let hash = 2166136261;
      for (let i = 0; i < value.length; i++) {
        hash ^= value.charCodeAt(i);
        hash = Math.imul(hash, 16777619);
      }

      return Array.from({ length: 1536 }, (_, i) => {
        hash ^= i;
        hash = Math.imul(hash, 16777619);
        return (hash >>> 0) / 0xffffffff;
      });
    });
  }

  const res = await fetch('https://api.openai.com/v1/embeddings', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${openAiKey}`,
    },
    body: JSON.stringify({ model: 'text-embedding-3-small', input: values }),
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`OpenAI embeddings failed ${res.status}: ${body.slice(0, 200)}`);
  }
  const json = (await res.json()) as { data: Array<{ embedding: number[] }> };
  return json.data.map((d) => d.embedding);
}

async function seedCatalog() {
  const dbUrl = nodeEnv.NEON_DATABASE_URL;
  const openAiKey = nodeEnv.OPENAI_API_KEY;
  if (!dbUrl) throw new Error('NEON_DATABASE_URL is required');
  if (!openAiKey) throw new Error('OPENAI_API_KEY is required');

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
    const existing = await db.select({ sku: schema.catalogItems.sku }).from(schema.catalogItems);
    const knownSkus = new Set(existing.map((r) => r.sku));
    const newItems = ITEMS.filter((i) => !knownSkus.has(i.sku));
    if (newItems.length === 0) {
      console.log(`Catalog already seeded (${existing.length} rows).`);
      return;
    }

    console.log(`Generating ${newItems.length} embeddings via OpenAI...`);
    const embeddings = await embedAll({
      values: newItems.map((i) => `${i.name}. ${i.description}`),
      openAiKey,
    });

    for (let i = 0; i < newItems.length; i++) {
      const item = newItems[i];
      const embedding = embeddings[i];
      if (!item || !embedding) continue;
      await db.insert(schema.catalogItems).values({
        name: item.name,
        productUrl: `https://example.com/${item.sku}`,
        sku: item.sku,
        weight: item.weight,
        weightUnit: item.weightUnit,
        description: item.description,
        categories: item.categories,
        brand: item.brand ?? null,
        embedding,
      });
    }
    console.log(`Seeded ${newItems.length} catalog items.`);
  } finally {
    await pgClient?.end();
  }
}

seedCatalog().catch((err) => {
  console.error(err);
  process.exit(1);
});
