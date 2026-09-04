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
 * # Nothing to register here
 *
 * Everything is derived from `APP_CONFIG.featureFlags`. Adding a feature is one
 * line in packages/config/src/config.ts and nothing else — this script needs no
 * edit, ever:
 *
 *   key         ← the flag key
 *   enabled     ← the coded default, so the seed cannot disagree with the binary
 *   access key  ← featureAccessKeyForFlag (drop `enable`, kebab-case)
 *   label       ← featureLabelForFlag ("Summit Log")
 *
 * An earlier version kept a hand-written table of labels and descriptions here.
 * That made adding a feature a three-place edit, and the third place is exactly
 * the one that gets forgotten.
 *
 * # Access defaults closed
 *
 * `feature_access` has no "closed" state of its own — the resolver reads a null
 * or past `early_access_until` as generally available — so seeding null would
 * publish every new feature to everyone. New features therefore seed with a
 * real early-access window and are Pro-gated until someone widens them in the
 * database.
 *
 * Features that predate this convention are listed in GENERALLY_AVAILABLE
 * below: they already shipped to everyone, and applying a window retroactively
 * would take away access people already have. That list is closed — it will not
 * grow, because everything new goes through the convention.
 *
 * The flag is still the real backstop: it defaults false, so a new feature is
 * dark regardless. The access default is the second layer, for when the flag
 * gets turned on before anyone has thought about audience.
 *
 * # Running
 *
 * CI runs this automatically — .github/workflows/migrations.yml invokes it
 * right after migrations, so a new feature's rows land without anyone
 * remembering. By hand:
 *
 *   cd packages/api && bun run db:seed:feature-controls
 *
 * Idempotent: every insert is ON CONFLICT DO NOTHING, so re-running never
 * clobbers a row an operator has since changed — including a nicer label typed
 * into the admin UI.
 *
 * Deliberately NOT a Drizzle migration. Migrations own schema; this is data.
 * Keeping it out means the `drizzle-kit generate` rule in CLAUDE.md stays
 * absolute with no carve-out.
 */

import { neon, neonConfig } from '@neondatabase/serverless';
import {
  APP_CONFIG,
  earlyAccessUntilFrom,
  featureAccessKeyForFlag,
  featureLabelForFlag,
} from '@packrat/config';
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
 * Flags that shipped before this convention existed, seeded free for everyone.
 *
 * A closed list. Do not add to it: a new feature seeds Pro-gated and is widened
 * in the database when you decide to, not by editing this file.
 */
const GENERALLY_AVAILABLE: ReadonlySet<string> = new Set([
  'enableOAuth',
  'enableTrips',
  'enablePackInsights',
  'enableShoppingList',
  'enableSharedPacks',
  'enablePackTemplates',
  'enableTrailConditions',
  'enableFeed',
  'enableWildlifeIdentification',
  'enableLocalAI',
  'enableTrails',
  'enableRevenueCat',
]);

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
    const flagKeys = Object.keys(APP_CONFIG.featureFlags);

    const flagRows = Object.entries(APP_CONFIG.featureFlags).map(([key, enabled]) => ({
      key,
      enabled,
      description: null,
    }));

    // One timestamp for the whole run, so features seeded together graduate
    // together rather than drifting apart by milliseconds.
    const seededAt = new Date();
    const earlyAccessUntil = earlyAccessUntilFrom(seededAt);

    const accessRows = flagKeys.map((flagKey) => ({
      key: featureAccessKeyForFlag(flagKey),
      label: featureLabelForFlag(flagKey),
      description: null,
      earlyAccessUntil: GENERALLY_AVAILABLE.has(flagKey) ? null : earlyAccessUntil,
    }));

    await db
      .insert(featureFlags)
      .values(flagRows)
      .onConflictDoNothing({ target: featureFlags.key });
    await db
      .insert(featureAccess)
      .values(accessRows)
      .onConflictDoNothing({ target: featureAccess.key });

    const gated = accessRows.filter((row) => row.earlyAccessUntil !== null).length;

    console.log(`[seed] feature_flags:  ${flagRows.length} row(s) ensured`);
    console.log(
      `[seed] feature_access: ${accessRows.length} row(s) ensured ` +
        `(${gated} early-access, ${accessRows.length - gated} generally available)`,
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
