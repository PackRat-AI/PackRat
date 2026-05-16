/**
 * Helpers that translate Eden Treaty's `{ data, error, status }` responses
 * into CLI behaviour: print friendly errors, return clean data, exit non-zero
 * when ACL/auth fails. Used by every API-talking command.
 */

import { isObject, isString } from '@packrat/guards';
import chalk from 'chalk';
import consola from 'consola';
import { loadConfig } from './config';

export type TreatyResponse<T> = {
  data: T | null;
  error: { status: number; value: unknown } | null;
  status: number;
};

export type RunOptions = {
  /** Verb phrase shown in error messages, e.g. "list packs". */
  action: string;
  /** Resource hint shown when 403/404 fires. */
  resourceHint?: string;
  /** True when the call hits an admin-only route. */
  requiresAdmin?: boolean;
};

/**
 * Await a Treaty call, return `data` on success, or print a friendly error and
 * `process.exit(1)`. Never returns null.
 */
export async function runApi<T>(
  promise: Promise<TreatyResponse<T>>,
  opts: RunOptions,
): Promise<T> {
  const result = await promise;
  if (result.error || result.data == null) {
    printError(result.status, result.error?.value, opts);
    process.exit(1);
  }
  return result.data;
}

/**
 * Variant that does NOT exit on error — returns a discriminated union. Useful
 * when the command wants to react to a failure (e.g. retry, fallback).
 */
export async function tryApi<T>(
  promise: Promise<TreatyResponse<T>>,
): Promise<{ ok: true; data: T } | { ok: false; status: number; value: unknown }> {
  const result = await promise;
  if (result.error || result.data == null) {
    return { ok: false, status: result.status, value: result.error?.value ?? null };
  }
  return { ok: true, data: result.data };
}

/** Confirm a user is signed in; exit with a helpful hint if not. */
export async function requireAuth(): Promise<void> {
  const config = await loadConfig();
  if (!config.accessToken) {
    consola.error(
      `Not signed in. Run ${chalk.cyan('packrat auth login')} to authenticate first.`,
    );
    process.exit(1);
  }
}

/** Confirm an admin JWT is on disk and hasn't visibly expired. */
export async function requireAdmin(): Promise<void> {
  const config = await loadConfig();
  if (!config.adminToken) {
    consola.error(
      `No admin token. Run ${chalk.cyan('packrat admin login')} to mint one (you'll need the admin Basic credentials).`,
    );
    process.exit(1);
  }
  if (config.adminTokenExpiresAt && config.adminTokenExpiresAt < Date.now()) {
    consola.error(
      `Admin token expired. Run ${chalk.cyan('packrat admin login')} to re-authenticate.`,
    );
    process.exit(1);
  }
}

function printError(status: number, body: unknown, opts: RunOptions): void {
  const action = opts.action;
  const resource = opts.resourceHint ? ` (${opts.resourceHint})` : '';
  const detail = extractMessage(body);
  const suffix = detail ? `\n  ${chalk.dim(detail)}` : '';

  if (status === 401) {
    if (opts.requiresAdmin) {
      consola.error(
        `Admin authentication required to ${action}${resource}. ` +
          `Run ${chalk.cyan('packrat admin login')} first.${suffix}`,
      );
      return;
    }
    consola.error(
      `Not signed in or session expired (${action}${resource}). ` +
        `Run ${chalk.cyan('packrat auth login')}.${suffix}`,
    );
    return;
  }
  if (status === 403) {
    if (opts.requiresAdmin) {
      consola.error(
        `Forbidden: this is an admin-only operation (${action}${resource}). ` +
          `Your account lacks the admin role.${suffix}`,
      );
      return;
    }
    consola.error(
      `Forbidden: you don't own this resource (${action}${resource}), or the API rejected the call.${suffix}`,
    );
    return;
  }
  if (status === 404) {
    consola.error(`Not found: ${action}${resource} returned 404.${suffix}`);
    return;
  }
  if (status === 409) consola.error(`Conflict on ${action}${resource}.${suffix}`);
  else if (status === 422) consola.error(`Validation failed on ${action}${resource}.${suffix}`);
  else if (status === 429) consola.error(`Rate limited on ${action}${resource}.${suffix}`);
  else consola.error(`${action}${resource} failed (HTTP ${status})${suffix}`);
}

function extractMessage(body: unknown): string | null {
  if (body == null) return null;
  if (isString(body)) return body;
  if (isObject(body)) {
    const obj = body as Record<string, unknown>;
    if (isString(obj.message)) return obj.message;
    if (isString(obj.error)) return obj.error;
    try {
      return JSON.stringify(body);
    } catch {
      return null;
    }
  }
  return String(body);
}
