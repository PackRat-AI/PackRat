/**
 * Seed: the two control rows every feature is required to have.
 *
 *   feature_flags  — can this be on at all?
 *   feature_access — who may use it?
 *
 * Both tables were created empty, so every runtime read falls through to a
 * default: the coded flag value compiled into the binary, and "generally
 * available" for a missing feature_access row. Seeding makes the controls real,
 * so a feature can be turned on or placed behind Pro in the database without a
 * release.
 *
 * Deliberately NOT a Drizzle migration. Migrations own schema; this is data.
 * Keeping it out means the `drizzle-kit generate` rule in CLAUDE.md stays
 * absolute with no carve-out, and re-seeding does not require inventing a new
 * migration each time.
 *
 * CI runs this automatically: .github/workflows/migrations.yml invokes it right
 * after migrations, so a new feature's rows land without anyone remembering to
 * seed by hand.
 *
 * Flag values mirror the coded defaults in packages/config/src/config.ts, so
 * the flag half of a first run changes no observable behaviour — it only moves
 * the answer from "no row, fall back to the binary" to "a row that says the
 * same thing". Once a row exists, the database is authoritative and this script
 * leaves it alone.
 *
 * Access rows are NOT seeded open. A null `early_access_until` reads as
 * generally available, so a feature with no explicit decision would be seeded
 * free for everyone. Anything not listed in FEATURE_CONTROLS as
 * 'generally-available' gets a real early-access window instead — see
 * AccessDefault below.
 *
 * feature_access keys are derived from flag names by the documented rule (drop
 * `enable`, kebab-case, a capital run is one word) via featureAccessKeyForFlag,
 * rather than being listed by hand — a second hand-maintained list is a second
 * thing to get out of sync.
 *
 * Usage:
 *   NEON_DATABASE_URL=<url> bun run packages/api/src/db/seed-feature-controls.ts
 *
 * Or via the package script:
 *   cd packages/api && bun run db:seed:feature-controls
 *
 * Idempotent: every insert is ON CONFLICT DO NOTHING, so re-running is
 * harmless and never clobbers a row an operator has since changed. New features
 * add their entry to FEATURE_CONTROLS below and re-run this.
 */

import { neon, neonConfig } from '@neondatabase/serverless';
import { APP_CONFIG, earlyAccessUntilFrom, featureAccessKeyForFlag } from '@packrat/config';
import { featureAccess, featureFlags } from '@packrat/db/schema';
import { nodeEnv } from '@packrat/env/node';
import { drizzle } from 'drizzle-orm/neon-http';
import { drizzle as drizzlePg } from 'drizzle-orm/node-postgres';
import { Client } from 'pg';
import WebSocket from 'ws';

neonConfig.webSocketConstructor = WebSocket;

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

/**
 * How a feature's access row is seeded.
 *
 *   'early-access'        — Pro-only for DEFAULT_EARLY_ACCESS_WEEKS from the
 *                           seed run. The default for anything new.
 *   'generally-available' — free for everyone from the start.
 *
 * `feature_access` has no "closed" state of its own: the resolver reads a null
 * or past `early_access_until` as generally available. A row seeded with null
 * is therefore a row that is *open*, which is the wrong default for a feature
 * nobody has decided on. Seeding a future window instead means a new feature is
 * Pro-gated until someone consciously widens it.
 *
 * The flag is still the real backstop — it defaults false, so a new feature is
 * dark regardless. This is the second layer: if the flag gets turned on before
 * anyone thinks about audience, the feature reaches Pro members, not everyone.
 */
type AccessDefault = 'early-access' | 'generally-available';

/**
 * Per-flag metadata. `enabled` is not listed — it comes from packages/config so
 * the seed cannot disagree with the coded default — and the access key is
 * derived. Only the prose and the access default live here.
 */
const FEATURE_CONTROLS: Record<
  string,
  { label: string; description: string; access: AccessDefault }
> = {
  // The 12 flags predating this convention are all 'generally-available':
  // they already shipped to everyone, and applying an early-access window
  // retroactively would take away access people already have. The monetization
  // model never does that — a feature only ever moves from Pro-first to free.
  enableOAuth: {
    label: 'OAuth sign-in',
    description: 'Google and Apple sign-in',
    access: 'generally-available',
  },
  enableTrips: { label: 'Trips', description: 'Trip planning', access: 'generally-available' },
  enablePackInsights: {
    label: 'Pack Insights',
    description: 'AI-generated pack analysis',
    access: 'generally-available',
  },
  enableShoppingList: {
    label: 'Shopping List',
    description: 'Shopping list',
    access: 'generally-available',
  },
  enableSharedPacks: {
    label: 'Shared Packs',
    description: 'Pack sharing between users',
    access: 'generally-available',
  },
  enablePackTemplates: {
    label: 'Pack Templates',
    description: 'Reusable pack templates',
    access: 'generally-available',
  },
  enableTrailConditions: {
    label: 'Trail Conditions',
    description: 'Trail condition reports',
    access: 'generally-available',
  },
  enableFeed: { label: 'Feed', description: 'Social feed', access: 'generally-available' },
  enableWildlifeIdentification: {
    label: 'Wildlife Identification',
    description: 'Wildlife photo identification',
    access: 'generally-available',
  },
  enableLocalAI: {
    label: 'Local AI',
    description: 'On-device AI inference',
    access: 'generally-available',
  },
  enableTrails: {
    label: 'Trails',
    description: 'Trail search and detail',
    access: 'generally-available',
  },
  enableRevenueCat: {
    label: 'Subscriptions',
    description: 'Subscriptions and entitlements',
    access: 'generally-available',
  },
};

/**
 * The access default for a flag with no entry above — i.e. every new feature.
 * Closed, not open.
 */
const DEFAULT_ACCESS: AccessDefault = 'early-access';

/**
 * Access keys that do not follow the derivation rule.
 *
 * `packages/api/src/routes/wildlife/index.ts:33` enforces access under the
 * literal 'wildlife', where the rule gives 'wildlife-identification'. It
 * predates the convention, and the live gate resolves against this key, so the
 * row has to exist. Remove this once that route is migrated.
 */
const LEGACY_ACCESS_KEYS: {
  key: string;
  label: string;
  description: string;
  access: AccessDefault;
}[] = [
  {
    key: 'wildlife',
    label: 'Wildlife (legacy key)',
    description: 'Legacy key used by the wildlife route gate',
    // Already shipped, so generally available for the same reason as the other
    // pre-convention features: an early-access window here would newly gate a
    // live route behind Pro.
    access: 'generally-available',
  },
];

export async function seedFeatureControls() {
  const url = nodeEnv.NEON_DATABASE_URL;
  if (!url) throw new Error('NEON_DATABASE_URL is not set');

  let pgClient: Client | undefined;
  const db = isStandardPostgresUrl(url)
    ? await (async () => {
        pgClient = new Client({ connectionString: url });
        await pgClient.connect();
        return drizzlePg(pgClient);
      })()
    : drizzle(neon(url));

  try {
    const flagRows = Object.entries(APP_CONFIG.featureFlags).map(([key, enabled]) => ({
      key,
      enabled,
      description: FEATURE_CONTROLS[key]?.description ?? null,
    }));

    // One timestamp for the whole run, so every early-access feature seeded
    // together graduates together rather than drifting by milliseconds.
    const seededAt = new Date();

    const accessRows = Object.keys(APP_CONFIG.featureFlags).map((flagKey) => {
      const meta = FEATURE_CONTROLS[flagKey];
      const access = meta?.access ?? DEFAULT_ACCESS;
      return {
        key: featureAccessKeyForFlag(flagKey),
        label: meta?.label ?? flagKey,
        description: meta?.description ?? null,
        // A window for anything not explicitly declared generally available.
        // Null would mean open, which is not a safe default for a feature
        // nobody has ruled on — see AccessDefault.
        earlyAccessUntil: access === 'early-access' ? earlyAccessUntilFrom(seededAt) : null,
      };
    });

    await db
      .insert(featureFlags)
      .values(flagRows)
      .onConflictDoNothing({ target: featureFlags.key });
    await db
      .insert(featureAccess)
      .values([
        ...accessRows,
        ...LEGACY_ACCESS_KEYS.map(({ access, ...row }) => ({
          ...row,
          earlyAccessUntil: access === 'early-access' ? earlyAccessUntilFrom(seededAt) : null,
        })),
      ])
      .onConflictDoNothing({ target: featureAccess.key });

    console.log(`[seed] feature_flags:  ${flagRows.length} row(s) ensured`);
    console.log(
      `[seed] feature_access: ${accessRows.length + LEGACY_ACCESS_KEYS.length} row(s) ensured`,
    );
    console.log('[seed] Existing rows were left untouched (ON CONFLICT DO NOTHING).');
  } finally {
    await pgClient?.end();
  }
}

if (import.meta.main) {
  seedFeatureControls().catch((err) => {
    console.error('[seed] Failed:', err);
    process.exit(1);
  });
}
