#!/usr/bin/env bun
/**
 * Seed the OpenAI/Anthropic reviewer account with the fixture data the
 * submission test cases depend on.
 *
 * WHY THIS EXISTS
 *
 * Two of the five submission test cases read a pack that must already
 * exist on the reviewer's account:
 *
 *   TC3 — "What's the total weight of my Lost Coast Trail pack, and am I
 *          missing any essentials?"
 *   TC4 — "Find lighter alternatives for the heaviest items in my Lost Coast
 *          Trail pack."
 *
 * The name is deliberately distinct from TC1's destination: TC1 creates its
 * own "Tuolumne Meadows 3-Day" pack, so reusing Yosemite here would leave two
 * lookalike packs on the account and make "my <X> pack" ambiguous.
 *
 * The reviewer account is wiped between test rounds, so without this
 * script those cases fail for setup reasons rather than product reasons —
 * which is indistinguishable, from the reviewer's side, from the app being
 * broken.
 *
 * WHY THE ITEM NAMES ARE THE WAY THEY ARE (do not casually reword them)
 *
 * TC4 asks for *lighter alternatives*, which routes through
 * `packrat_similar_pack_items` — a vector-similarity search over the gear
 * catalog, filtered by `lighter_only`. Similarity is computed against the
 * pack item's NAME, so a name that embeds closer to the wrong product
 * category returns useless results.
 *
 * This bit us during a review run: a pack item named "40L backpack with
 * rain cover" returned rain covers rather than backpacks, because the
 * phrase embeds nearer to "rain cover" than to "backpack". The model got
 * nothing usable, fell back to the open web, and quoted weights for
 * products that are not in our catalog while attributing them to PackRat.
 *
 * Every name below was verified empirically (embedded via
 * text-embedding-3-small, queried against the live catalog with the
 * `lighter_only` filter applied) to return same-category, genuinely
 * lighter, coherent products. Keep names simple and category-forward:
 * "65L backpacking backpack" works, "40L backpack with rain cover" does not.
 *
 * The four heavy items are also deliberately chosen from categories whose
 * catalog weight data is trustworthy. See issue #2735 — `catalog_items.weight`
 * is unreliable in places (30% of 2-person tents record >3 kg; some rows are
 * stored in pounds). Tents are borderline, so the tent here is a mid-weight
 * shelter with hundreds of coherent lighter candidates rather than an
 * ultralight one competing with bad rows.
 *
 * USAGE
 *
 *   bun packages/mcp/scripts/seed-reviewer-account.ts \
 *     --token <reviewer-access-token> \
 *     [--api https://api.packratai.com] \
 *     [--dry-run]
 *
 * Get the token by signing into the reviewer account and copying its access
 * token, or by minting one through the normal auth flow. The script only
 * ever calls the public REST API as that user — it needs no DB access and
 * no admin rights.
 *
 * Idempotent: if a pack named "Lost Coast Trail" already exists on the
 * account, the script reports it and exits without creating a duplicate,
 * unless --force is passed (which creates a second pack; prefer cleaning up
 * first).
 */

type ItemCategory =
  | 'clothing'
  | 'shelter'
  | 'sleep'
  | 'kitchen'
  | 'water'
  | 'electronics'
  | 'first-aid'
  | 'navigation'
  | 'tools'
  | 'consumables'
  | 'miscellaneous';

interface SeedItem {
  name: string;
  category: ItemCategory;
  weight_grams: number;
  quantity?: number;
  is_consumable?: boolean;
  is_worn?: boolean;
  notes?: string;
}

/**
 * The pack TC3 and TC4 both read.
 *
 * Deliberately NOT a Yosemite/Tuolumne name: TC1's prompt creates its own
 * pack ("Tuolumne Meadows 3-Day — Aug 30–Sep 1"), so a fixture sharing that
 * destination would leave two similar packs on the account and make TC3's
 * "my <X> pack" ambiguous — the model could analyse either one, and which it
 * picks would vary by run. A distinct destination keeps the fixture
 * unmistakable regardless of what other test cases have already created.
 */
const PACK_NAME = 'Lost Coast Trail';

const PACK = {
  name: PACK_NAME,
  description:
    'Three-day Lost Coast Trail backpacking trip. Seeded fixture for the app-submission test cases.',
  category: 'backpacking' as const,
  tags: ['lost-coast', 'backpacking', '3-day'],
};

/**
 * The four items TC4's "heaviest items" question lands on are listed first
 * and are the ones whose names were embedding-verified. The rest fill the
 * pack out so TC3's gap analysis has a realistic kit to reason about.
 */
const ITEMS: SeedItem[] = [
  // ── The four heavy items TC4 targets (names are embedding-verified) ──────
  {
    name: '2-person backpacking tent',
    category: 'shelter',
    weight_grams: 2200,
    notes: 'Double-wall, freestanding.',
  },
  {
    name: '65L backpacking backpack',
    category: 'tools',
    weight_grams: 1600,
    notes: 'Internal frame.',
  },
  {
    name: 'Down sleeping bag, 20F',
    category: 'sleep',
    weight_grams: 1400,
  },
  {
    name: 'Insulated sleeping pad',
    category: 'sleep',
    weight_grams: 700,
    notes: 'R-value 4.',
  },

  // ── Supporting kit — realistic pack, drives the TC3 gap analysis ─────────
  { name: 'Bear-resistant food canister', category: 'tools', weight_grams: 1100 },
  { name: 'Food for 3 days', category: 'consumables', weight_grams: 1800, is_consumable: true },
  { name: 'Canister stove', category: 'kitchen', weight_grams: 90 },
  { name: 'Cook pot 750ml', category: 'kitchen', weight_grams: 130 },
  { name: 'Fuel canister', category: 'consumables', weight_grams: 230, is_consumable: true },
  { name: 'Water filter', category: 'water', weight_grams: 90 },
  { name: 'Water bottles 2L', category: 'water', weight_grams: 100 },
  { name: 'Rain jacket', category: 'clothing', weight_grams: 300 },
  { name: 'Insulated jacket', category: 'clothing', weight_grams: 350 },
  { name: 'Fleece midlayer', category: 'clothing', weight_grams: 300 },
  { name: 'Base layer top and bottom', category: 'clothing', weight_grams: 250 },
  { name: 'Hiking boots', category: 'clothing', weight_grams: 900, is_worn: true },
  { name: 'Spare socks', category: 'clothing', weight_grams: 60, quantity: 2 },
  { name: 'Headlamp', category: 'electronics', weight_grams: 80 },
  { name: 'Map and compass', category: 'navigation', weight_grams: 120 },
  { name: 'First aid kit', category: 'first-aid', weight_grams: 200 },
  { name: 'Emergency bivy', category: 'first-aid', weight_grams: 110 },
  { name: 'Trekking poles', category: 'tools', weight_grams: 450, is_worn: true },
  { name: 'Repair kit and duct tape', category: 'tools', weight_grams: 80 },
  { name: 'Sunscreen and lip balm', category: 'miscellaneous', weight_grams: 90 },
];

// ── CLI ──────────────────────────────────────────────────────────────────────

function arg(flag: string): string | undefined {
  const i = process.argv.indexOf(flag);
  return i !== -1 ? process.argv[i + 1] : undefined;
}
const HAS = (flag: string): boolean => process.argv.includes(flag);

const TOKEN = arg('--token') ?? process.env.PACKRAT_REVIEWER_TOKEN;
const API = (arg('--api') ?? 'https://api.packratai.com').replace(/\/$/, '');
const DRY_RUN = HAS('--dry-run');
const FORCE = HAS('--force');

if (!TOKEN) {
  console.error(
    'Missing token.\n\n' +
      '  bun packages/mcp/scripts/seed-reviewer-account.ts --token <access-token>\n\n' +
      'Or set PACKRAT_REVIEWER_TOKEN. The token must belong to the reviewer\n' +
      'account itself — the script writes packs as that user via the public API.',
  );
  process.exit(1);
}

async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API}${path}`, {
    ...init,
    headers: {
      'content-type': 'application/json',
      authorization: `Bearer ${TOKEN}`,
      ...init?.headers,
    },
  });
  const text = await res.text();
  if (!res.ok) {
    throw new Error(`${init?.method ?? 'GET'} ${path} → ${res.status}: ${text.slice(0, 300)}`);
  }
  return (text ? JSON.parse(text) : {}) as T;
}

async function main(): Promise<void> {
  const totalGrams = ITEMS.reduce((n, i) => n + i.weight_grams * (i.quantity ?? 1), 0);
  console.log(`Seeding "${PACK_NAME}" → ${API}`);
  console.log(`  ${ITEMS.length} items, ${totalGrams} g total`);
  if (DRY_RUN) {
    console.log('\n--dry-run: nothing written. Items:');
    for (const i of ITEMS) {
      console.log(`  ${String(i.weight_grams).padStart(5)}g  ${i.category.padEnd(13)} ${i.name}`);
    }
    return;
  }

  // Idempotency: don't stack duplicate fixture packs on the reviewer account.
  const existing = await api<{ items?: { id: string; name: string }[] }>('/api/packs');
  const dupe = existing.items?.find((p) => p.name === PACK_NAME);
  if (dupe && !FORCE) {
    console.log(`\nPack "${PACK_NAME}" already exists (id ${dupe.id}). Nothing to do.`);
    console.log('Pass --force to create another anyway (prefer deleting the old one first).');
    return;
  }

  // The pack/item create endpoints take a CLIENT-supplied `id` plus
  // `localCreatedAt`/`localUpdatedAt` — they are built for the offline
  // outbox in the mobile app, where a replayed write must be idempotent
  // (the route does onConflictDoNothing on the id). Server-generated ids
  // are not an option, so the script mints UUIDs itself.
  const now = new Date().toISOString();
  const packId = crypto.randomUUID();
  await api('/api/packs', {
    method: 'POST',
    body: JSON.stringify({
      ...PACK,
      id: packId,
      localCreatedAt: now,
      localUpdatedAt: now,
    }),
  });
  console.log(`\nCreated pack ${packId}`);

  let added = 0;
  for (const item of ITEMS) {
    await api(`/api/packs/${packId}/items`, {
      method: 'POST',
      body: JSON.stringify({
        id: crypto.randomUUID(),
        name: item.name,
        category: item.category,
        weight: item.weight_grams,
        weightUnit: 'g',
        quantity: item.quantity ?? 1,
        consumable: item.is_consumable ?? false,
        worn: item.is_worn ?? false,
        ...(item.notes ? { notes: item.notes } : {}),
      }),
    });
    added += 1;
    process.stdout.write(`\r  added ${added}/${ITEMS.length}`);
  }
  console.log(`\n\nDone. "${PACK_NAME}" is ready for TC3 and TC4.`);
}

main().catch((err) => {
  console.error(`\nSeed failed: ${err instanceof Error ? err.message : String(err)}`);
  process.exit(1);
});
