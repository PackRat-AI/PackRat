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
 * migration each time. It runs as a post-deploy step alongside the other
 * seeders (see db:seed:oauth-clients, which CI already runs this way).
 *
 * Values mirror the coded defaults in packages/config/src/config.ts, so a first
 * run changes no observable behaviour — it only moves the answer from "no row,
 * fall back to the binary" to "a row that says the same thing". Once a row
 * exists, the database is authoritative and this script leaves it alone.
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
import { APP_CONFIG, featureAccessKeyForFlag } from '@packrat/config';
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
 * Human-readable metadata per flag. The `enabled` default and the access key
 * are not listed here — `enabled` comes from packages/config so the two cannot
 * disagree, and the key is derived. Only the prose lives here.
 */
const FEATURE_CONTROLS: Record<string, { label: string; description: string }> = {
  enableOAuth: { label: 'OAuth sign-in', description: 'Google and Apple sign-in' },
  enableTrips: { label: 'Trips', description: 'Trip planning' },
  enablePackInsights: { label: 'Pack Insights', description: 'AI-generated pack analysis' },
  enableShoppingList: { label: 'Shopping List', description: 'Shopping list' },
  enableSharedPacks: { label: 'Shared Packs', description: 'Pack sharing between users' },
  enablePackTemplates: { label: 'Pack Templates', description: 'Reusable pack templates' },
  enableTrailConditions: { label: 'Trail Conditions', description: 'Trail condition reports' },
  enableFeed: { label: 'Feed', description: 'Social feed' },
  enableWildlifeIdentification: {
    label: 'Wildlife Identification',
    description: 'Wildlife photo identification',
  },
  enableLocalAI: { label: 'Local AI', description: 'On-device AI inference' },
  enableTrails: { label: 'Trails', description: 'Trail search and detail' },
  enableRevenueCat: { label: 'Subscriptions', description: 'Subscriptions and entitlements' },
};

/**
 * Access keys that do not follow the derivation rule.
 *
 * `packages/api/src/routes/wildlife/index.ts:33` enforces access under the
 * literal 'wildlife', where the rule gives 'wildlife-identification'. It
 * predates the convention, and the live gate resolves against this key, so the
 * row has to exist. Remove this once that route is migrated.
 */
const LEGACY_ACCESS_KEYS: { key: string; label: string; description: string }[] = [
  {
    key: 'wildlife',
    label: 'Wildlife (legacy key)',
    description: 'Legacy key used by the wildlife route gate',
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

    const accessRows = Object.keys(APP_CONFIG.featureFlags).map((flagKey) => {
      const meta = FEATURE_CONTROLS[flagKey];
      return {
        key: featureAccessKeyForFlag(flagKey),
        label: meta?.label ?? flagKey,
        description: meta?.description ?? null,
        // NULL means generally available. A Pro-first window is set in the
        // database when someone decides on one, not seeded here — early access
        // is not something to apply retroactively to a shipped feature.
        earlyAccessUntil: null,
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
        ...LEGACY_ACCESS_KEYS.map((row) => ({ ...row, earlyAccessUntil: null })),
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
