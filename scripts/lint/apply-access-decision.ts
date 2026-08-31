#!/usr/bin/env bun
//
// apply-access-decision.ts — writes a merged PR's access decision into the
// `feature_access` table, so the entitlement database stays the single source
// of truth for who can use what.
//
// GitHub is only the controlled input here. Nothing about access lives in the
// repo: the PR body carries a human's decision, this script transcribes it, and
// every client keeps reading the database exactly as it did before.
//
// Runs on merge, not on the PR check. detect-access-decisions.ts is the gate
// that blocks; this is the write that follows once the decision is real.
//
// Usage:
//   bun scripts/lint/apply-access-decision.ts --body-file <path> [--dry-run]
//
// Environment:
//   PACKRAT_API_URL        base URL of the API
//   PACKRAT_ADMIN_USERNAME credentials exchanged for a short-lived admin JWT
//   PACKRAT_ADMIN_PASSWORD
//
// Exit code:
//   0 — nothing to do, or the row was written
//   1 — a decision was present but could not be applied
//   2 — misconfiguration (missing credentials, unreadable body)

import { existsSync, readFileSync } from 'node:fs';
import {
  AUDIENCES,
  DECLARATIONS,
  parseDecision,
  validateDecision,
} from './detect-access-decisions';

function readArg(name: string): string | undefined {
  const index = process.argv.indexOf(name);
  return index === -1 ? undefined : process.argv[index + 1];
}

/**
 * Exchanges admin credentials for a short-lived JWT.
 *
 * Reuses the existing `POST /admin/login` rather than adding a CI-specific
 * token path: a second way to authenticate as an admin is a second thing to
 * audit and rotate. Note this endpoint may sit behind Cloudflare Access
 * (CF_ACCESS_TEAM_DOMAIN / CF_ACCESS_AUD) — where it does, CI needs a service
 * token, which is a deployment concern rather than a code one.
 */
async function login(baseUrl: string, username: string, password: string): Promise<string> {
  const response = await fetch(`${baseUrl}/admin/login`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ username, password }),
  });

  if (!response.ok) {
    throw new Error(`admin login failed: ${response.status} ${await response.text()}`);
  }

  const body = (await response.json()) as { token?: string };
  if (!body.token) throw new Error('admin login returned no token');
  return body.token;
}

/**
 * Creates the `feature_access` row, or updates it when the key already exists.
 *
 * Re-running with the same decision is a no-op in effect, which matters because
 * a merge workflow can be re-run and a key may already have been placed under
 * early access by hand.
 */
async function upsertFeatureAccess({
  baseUrl,
  token,
  key,
  label,
  earlyAccessUntil,
}: {
  baseUrl: string;
  token: string;
  key: string;
  label: string;
  earlyAccessUntil: string | null;
}): Promise<void> {
  const headers = {
    'content-type': 'application/json',
    authorization: `Bearer ${token}`,
  };

  const created = await fetch(`${baseUrl}/admin/feature-access`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ key, label, earlyAccessUntil }),
  });

  if (created.ok) {
    console.log(`✓ Created feature_access row "${key}".`);
    return;
  }

  // 409 means the key exists; fall through to an update so a re-run converges
  // rather than failing.
  if (created.status !== 409) {
    throw new Error(`create failed: ${created.status} ${await created.text()}`);
  }

  const updated = await fetch(`${baseUrl}/admin/feature-access/${encodeURIComponent(key)}`, {
    method: 'PATCH',
    headers,
    body: JSON.stringify({ earlyAccessUntil }),
  });

  if (!updated.ok) {
    throw new Error(`update failed: ${updated.status} ${await updated.text()}`);
  }
  console.log(`✓ Updated feature_access row "${key}".`);
}

/**
 * Turns a decision into the `earlyAccessUntil` value the table stores.
 *
 * `everyone` is null — no window, free from the moment it ships. `early-access`
 * is the end of the day named by `expiry`, so a window through the 15th
 * includes all of the 15th rather than expiring at midnight as it begins.
 */
export function earlyAccessUntilFor(decision: {
  audience?: string;
  expiry?: string;
}): string | null {
  if (decision.audience !== AUDIENCES.EarlyAccess) return null;
  if (!decision.expiry) return null;
  return new Date(`${decision.expiry}T23:59:59.999Z`).toISOString();
}

async function main(): Promise<never> {
  const bodyFile = readArg('--body-file');
  if (!bodyFile || !existsSync(bodyFile)) {
    console.error('apply-access-decision: --body-file <path> is required and must exist.');
    process.exit(2);
  }

  const { decision, errors } = parseDecision(readFileSync(bodyFile, 'utf-8'));

  if (errors.length > 0) {
    console.error('✗ Could not read the access-decision block:');
    for (const problem of errors) console.error(`  - ${problem}`);
    process.exit(1);
  }

  if (!decision || decision.declaration === DECLARATIONS.None) {
    console.log('No new feature declared — nothing to write.');
    process.exit(0);
  }

  const problems = validateDecision(decision);
  if (problems.length > 0) {
    // Should be unreachable: the PR check blocks an incomplete decision from
    // merging. Treat it as a real failure rather than guessing at intent.
    console.error('✗ A new feature merged with an incomplete access decision:');
    for (const problem of problems) console.error(`  - ${problem}`);
    process.exit(1);
  }

  const key = decision.featureKey;
  if (!key) {
    console.error('✗ Decision passed validation but carries no feature-key.');
    process.exit(1);
  }

  const earlyAccessUntil = earlyAccessUntilFor(decision);

  if (process.argv.includes('--dry-run')) {
    console.log(
      `[dry-run] would upsert feature_access "${key}" with earlyAccessUntil=${earlyAccessUntil ?? 'null'}`,
    );
    process.exit(0);
  }

  const baseUrl = process.env.PACKRAT_API_URL;
  const username = process.env.PACKRAT_ADMIN_USERNAME;
  const password = process.env.PACKRAT_ADMIN_PASSWORD;

  if (!baseUrl || !username || !password) {
    console.error(
      'apply-access-decision: PACKRAT_API_URL, PACKRAT_ADMIN_USERNAME and PACKRAT_ADMIN_PASSWORD are required.',
    );
    process.exit(2);
  }

  try {
    const token = await login(baseUrl.replace(/\/$/, ''), username, password);
    await upsertFeatureAccess({
      baseUrl: baseUrl.replace(/\/$/, ''),
      token,
      key,
      // The table requires a label; the key is a reasonable stand-in that an
      // admin can rename. Inventing prose here would be the script making a
      // product decision it has no business making.
      label: key,
      earlyAccessUntil,
    });
  } catch (error) {
    console.error(`✗ Could not apply the access decision: ${error}`);
    process.exit(1);
  }

  process.exit(0);
}

if (import.meta.main) await main();
