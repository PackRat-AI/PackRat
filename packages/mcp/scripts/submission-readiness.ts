#!/usr/bin/env bun
/**
 * U18 + U7 refactor: pre-submission readiness probe for the PackRat MCP
 * Worker, updated for the cross-origin AS architecture.
 *
 * Operator runs this before filing Anthropic's Connector Store form
 * (https://clau.de/mcp-directory-submission). CI can run it via
 * `workflow_dispatch` from `.github/workflows/mcp-readiness.yml`. The script
 * probes two distinct hosts:
 *
 *   - RS (resource server)      = https://mcp.packratai.com
 *                                 hosts /mcp + PRM + /health + /status + favicon
 *   - AS (authorization server) = https://api.packrat.world
 *                                 hosts AS metadata + /oauth2/* + JWKS
 *
 * plus the brand domain (`packratai.com`) for the public docs / privacy /
 * terms pages. The probe emits a clear PASS / FAIL / WARN line per check
 * and exits 0 only when every check passes; CI gates the deploy tag on
 * green.
 *
 * Why this exists separately from the unit tests:
 *   The unit suite (`packages/mcp/src/__tests__/*.test.ts`) asserts the
 *   in-process shape of the worker. This script is the **deployed-server**
 *   probe — it catches the gaps the unit suite cannot:
 *     - DNS / TLS / custom-domain reachability on both hosts
 *     - WAF blocks of Anthropic's discovery probes against the AS
 *     - The PRM / AS metadata cross-reference still pointing at the right host
 *     - The brand domain rendering the public docs page
 *
 * Anthropic's documented rejection-reason taxonomy (per the connector-store
 * docs as of plan-drafting) shapes the check order. Post-refactor the DCR
 * gate check is gone (DCR is disabled at the AS via
 * `allowDynamicClientRegistration: false`; there's no `/register` route to
 * probe), leaving 12 checks:
 *   1.  TLS reachability (RS)                          — table-stakes
 *   2.  RS /mcp returns 401 WWW-Authenticate           — RFC 9728 §5.1
 *   3.  RS /.well-known/oauth-protected-resource       — RFC 9728 metadata
 *   4.  AS /.well-known/oauth-authorization-server     — RFC 8414 metadata
 *   5.  Pre-registered Claude client recognised by AS  — install flow gate (WARN)
 *   6.  Favicon at RS                                  — domain-ownership probe
 *   7.  Public docs URL (brand domain)                 — reviewer-facing
 *   8.  Privacy + Terms reachable (brand domain)       — immediate-reject cause
 *   9.  Support contact resolvable via RS /health      — listing requirement
 *  10.  RS /health is healthy                          — operator + uptime gate
 *  10b. RS /status advertises scopes_supported         — cross-check
 *  11.  Tool annotations on every tool                 — #1 rejection cause
 *  12.  Tool descriptions non-promotional              — content rules
 *
 * CLI:
 *   bun packages/mcp/scripts/submission-readiness.ts
 *   bun packages/mcp/scripts/submission-readiness.ts \
 *     --rs-url https://staging-mcp.example.com \
 *     --as-url https://staging-api.example.com
 *   bun packages/mcp/scripts/submission-readiness.ts --json
 *
 * Output:
 *   Default — colour-coded one-line-per-check + a `N/13 passed` summary
 *             (12 numbered checks plus the 10b /status cross-check; the
 *             prior 14th DCR-gate check is deleted).
 *   --json  — `{ checks: [...], summary: { passed, failed, warned } }`.
 *
 * Exit codes:
 *   0 — every check passed
 *   1 — at least one check failed
 *   2 — bad CLI args
 *
 * Run env: Bun runtime (Node APIs are available). Do NOT run this against
 * production until both workers have actually been deployed; the operator
 * runs it once the deploy is live, and CI runs it on-demand via
 * workflow_dispatch.
 */

import { readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { isBoolean, isObject, isString, toRecord } from '@packrat/guards';

// Local helper: format an unknown thrown value's message without an `as Error` cast.
// Node convention — many of our error handlers only need the message string.
const errMessage = (err: unknown): string => (err instanceof Error ? err.message : String(err));

// ── Public types (also re-exported for the unit tests) ────────────────────

export type CheckStatus = 'pass' | 'fail' | 'warn';

export interface CheckResult {
  /** Stable identifier for the check (used in JSON output). */
  name: string;
  /** Human-readable label printed in default output. */
  label: string;
  status: CheckStatus;
  /** Short detail line printed after the status. */
  details: string;
}

export interface ReadinessSummary {
  passed: number;
  failed: number;
  warned: number;
  total: number;
}

export interface ReadinessReport {
  rsUrl: string;
  asUrl: string;
  brandDomain: string;
  checks: CheckResult[];
  summary: ReadinessSummary;
}

// ── Defaults & constants ──────────────────────────────────────────────────

/** Resource server (the MCP worker). */
export const DEFAULT_RS_URL = 'https://mcp.packratai.com';
/** Authorization server (the API worker hosting @better-auth/oauth-provider). */
export const DEFAULT_AS_URL = 'https://api.packrat.world';
export const DEFAULT_BRAND_DOMAIN = 'https://packratai.com';

/**
 * Backwards-compat alias for the prior single-target constant. Resolves to
 * the resource-server URL (which is where the prior single-target probe
 * actually pointed for most checks). Retained so existing imports don't
 * blow up; tests should prefer `DEFAULT_RS_URL` / `DEFAULT_AS_URL`.
 * @deprecated Use DEFAULT_RS_URL instead.
 */
export const DEFAULT_TARGET_URL = DEFAULT_RS_URL;

/**
 * Marketing-claim words that get listings rejected for promotional language.
 * Matching is case-insensitive on whole-word boundaries; "AI" alone is fine
 * (it's factual) but "AI-powered" *as a hype phrase* is flagged.
 */
export const FORBIDDEN_PROMO_PATTERNS: ReadonlyArray<{ pattern: RegExp; label: string }> = [
  { pattern: /\brevolutionary\b/i, label: 'revolutionary' },
  { pattern: /\bbest[- ]in[- ]class\b/i, label: 'best-in-class' },
  { pattern: /\bworld[- ]class\b/i, label: 'world-class' },
  { pattern: /\bcutting[- ]edge\b/i, label: 'cutting-edge' },
  { pattern: /\bstate[- ]of[- ]the[- ]art\b/i, label: 'state-of-the-art' },
  { pattern: /\bgame[- ]chang(?:er|ing)\b/i, label: 'game-changer' },
  // "AI-powered" as a marketing value claim — "AI for X" / "uses AI" is fine.
  { pattern: /\bAI[- ]powered\b/i, label: 'AI-powered (value claim)' },
];

/** Required scopes the protected-resource metadata MUST advertise. */
export const REQUIRED_SCOPES = ['mcp', 'mcp:read', 'mcp:write', 'mcp:admin'] as const;

/** Per-request fetch timeout in ms. */
const FETCH_TIMEOUT_MS = 10_000;

// Module-scope regex literals (biome rule `useTopLevelRegex`): hoisted so
// repeated check invocations don't recompile the literals.
const RESOURCE_METADATA_RE = /resource_metadata=/i;
const SCOPE_PARAM_RE = /scope=/i;

// ── CLI parsing ───────────────────────────────────────────────────────────

interface CliArgs {
  rsUrl: string;
  asUrl: string;
  brandDomain: string;
  json: boolean;
  catalogPath: string | null;
  help: boolean;
}

export function parseArgs(argv: readonly string[]): CliArgs {
  const args: CliArgs = {
    rsUrl: DEFAULT_RS_URL,
    asUrl: DEFAULT_AS_URL,
    brandDomain: DEFAULT_BRAND_DOMAIN,
    json: false,
    catalogPath: null,
    help: false,
  };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    switch (arg) {
      case '--rs-url':
        args.rsUrl = stripTrailingSlash(requireValue({ argv, idx: ++i, name: '--rs-url' }));
        break;
      case '--as-url':
        args.asUrl = stripTrailingSlash(requireValue({ argv, idx: ++i, name: '--as-url' }));
        break;
      case '--url':
        // Legacy single-target form. The pre-refactor script probed one
        // host for both the resource server and the authorization server,
        // but post-refactor those are different origins. Rather than
        // silently guessing the AS URL (e.g. by string-munging the RS
        // host), error out and tell the operator to pass both explicitly.
        throw new Error(
          '--url is no longer supported (AS and RS are on different origins post-refactor). ' +
            'Pass --rs-url and --as-url explicitly. ' +
            `Prod defaults: --rs-url ${DEFAULT_RS_URL} --as-url ${DEFAULT_AS_URL}`,
        );
      case '--brand-domain':
        args.brandDomain = stripTrailingSlash(
          requireValue({ argv, idx: ++i, name: '--brand-domain' }),
        );
        break;
      case '--catalog':
        args.catalogPath = requireValue({ argv, idx: ++i, name: '--catalog' });
        break;
      case '--json':
        args.json = true;
        break;
      case '-h':
      case '--help':
        args.help = true;
        break;
      default:
        throw new Error(`Unknown argument: ${arg}`);
    }
  }
  return args;
}

function requireValue(opts: { argv: readonly string[]; idx: number; name: string }): string {
  const v = opts.argv[opts.idx];
  if (!v) throw new Error(`${opts.name} requires a value`);
  return v;
}

function stripTrailingSlash(url: string): string {
  return url.endsWith('/') ? url.slice(0, -1) : url;
}

function printHelp(): void {
  console.log(`submission-readiness — pre-submission probe for the PackRat MCP Worker

Usage:
  bun packages/mcp/scripts/submission-readiness.ts [--rs-url URL] [--as-url URL] [--brand-domain URL] [--catalog PATH] [--json]

Flags:
  --rs-url <url>            MCP resource-server base URL (default: ${DEFAULT_RS_URL})
  --as-url <url>            OAuth authorization-server base URL (default: ${DEFAULT_AS_URL})
  --brand-domain <url>      PackRat brand domain (default: ${DEFAULT_BRAND_DOMAIN})
  --catalog <path>          Override the catalog JSON path (default: auto-detect)
  --json                    Emit machine-readable JSON; suppresses colour.
  -h, --help                Print this help.

Notes:
  Post-refactor the AS and RS live on different origins. The legacy --url
  flag is no longer accepted — pass --rs-url and --as-url explicitly.
  Claude pre-registration is seeded directly into the API's oauthClient
  table via the db:seed:oauth-clients package script
  (packages/api/src/db/seed-claude-oauth-client.ts); the
  --claude-client-id probe is gone (the AS exposes no public list endpoint
  and the seed script is the source of truth).

Exit codes:
  0  every check passed
  1  at least one check failed
  2  bad CLI args
`);
}

// ── ANSI colour helpers ───────────────────────────────────────────────────

const ANSI = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  dim: '\x1b[2m',
  bold: '\x1b[1m',
};

function isTty(): boolean {
  return Boolean(process.stdout.isTTY);
}

function colorize(text: string, color: keyof typeof ANSI): string {
  return isTty() ? `${ANSI[color]}${text}${ANSI.reset}` : text;
}

const STATUS_GLYPH: Record<CheckStatus, string> = {
  pass: '✓',
  fail: '✗',
  warn: '!',
};

const STATUS_COLOR: Record<CheckStatus, keyof typeof ANSI> = {
  pass: 'green',
  fail: 'red',
  warn: 'yellow',
};

// ── HTTP primitive ────────────────────────────────────────────────────────

export interface ProbeResponse {
  ok: boolean;
  status: number;
  headers: Headers;
  bodyText: string;
  url: string;
  error?: string;
}

export interface ProbeOptions {
  url: string;
  init?: RequestInit;
  fetchImpl?: typeof fetch;
}

/**
 * Fetch wrapper with a 10s timeout and a never-throws contract — every
 * branch returns a ProbeResponse so the calling check can format its
 * details deterministically.
 */
export async function probe(opts: ProbeOptions): Promise<ProbeResponse> {
  const { url, init = {}, fetchImpl = globalThis.fetch } = opts;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetchImpl(url, { ...init, signal: controller.signal, redirect: 'manual' });
    const bodyText = await res.text().catch(() => '');
    return {
      ok: res.ok,
      status: res.status,
      headers: res.headers,
      bodyText,
      url,
    };
  } catch (err) {
    return {
      ok: false,
      status: 0,
      headers: new Headers(),
      bodyText: '',
      url,
      error: errMessage(err),
    };
  } finally {
    clearTimeout(timer);
  }
}

// ── Check primitives (exported for unit tests) ────────────────────────────

/**
 * Check 1 — TLS + custom domain reachability on the resource server. The
 * worker root MUST return 200 over HTTPS, with no insecure redirect, and
 * the URL host must match the targeted hostname.
 */
export function checkTlsReachability(targetUrl: string, res: ProbeResponse): CheckResult {
  const name = 'tls_reachability';
  const label = '1. TLS + custom domain reachability (RS)';
  if (!targetUrl.startsWith('https://')) {
    return { name, label, status: 'fail', details: `target URL is not HTTPS: ${targetUrl}` };
  }
  if (res.error) {
    return { name, label, status: 'fail', details: `fetch error: ${res.error}` };
  }
  if (res.status !== 200) {
    return { name, label, status: 'fail', details: `GET / returned ${res.status} (expected 200)` };
  }
  try {
    const targetHost = new URL(targetUrl).host;
    const resHost = new URL(res.url).host;
    if (targetHost !== resHost) {
      return {
        name,
        label,
        status: 'fail',
        details: `response URL host ${resHost} ≠ target host ${targetHost}`,
      };
    }
  } catch (err) {
    return { name, label, status: 'fail', details: `URL parse error: ${errMessage(err)}` };
  }
  return { name, label, status: 'pass', details: `200 OK over HTTPS at ${targetUrl}` };
}

/**
 * Check 2 — `/mcp` returns 401 with a spec-compliant `WWW-Authenticate`
 * header (`resource_metadata=...` per RFC 9728 §5.1 plus `scope=...`). A
 * 404 or 500 here would silently break the entire MCP discovery handshake.
 */
export function checkStreamableHttpAuth(res: ProbeResponse): CheckResult {
  const name = 'streamable_http_auth';
  const label = '2. RS /mcp returns 401 with RFC 9728 WWW-Authenticate';
  if (res.error) {
    return { name, label, status: 'fail', details: `fetch error: ${res.error}` };
  }
  if (res.status !== 401) {
    return {
      name,
      label,
      status: 'fail',
      details: `POST /mcp returned ${res.status} (expected 401)`,
    };
  }
  const wwwAuth = res.headers.get('www-authenticate') ?? '';
  if (!wwwAuth) {
    return { name, label, status: 'fail', details: '401 response missing WWW-Authenticate header' };
  }
  if (!RESOURCE_METADATA_RE.test(wwwAuth)) {
    return {
      name,
      label,
      status: 'fail',
      details: `WWW-Authenticate lacks resource_metadata=... : ${wwwAuth}`,
    };
  }
  if (!SCOPE_PARAM_RE.test(wwwAuth)) {
    return {
      name,
      label,
      status: 'fail',
      details: `WWW-Authenticate lacks scope=... : ${wwwAuth}`,
    };
  }
  return { name, label, status: 'pass', details: '401 + resource_metadata + scope advertised' };
}

/**
 * Check 3 — RS `/.well-known/oauth-protected-resource` (RFC 9728) returns
 * a valid JSON document with `resource`, `authorization_servers` (which
 * MUST advertise the cross-origin AS URL — post-refactor this is
 * `api.packrat.world`, NOT `mcp.packratai.com`), `scopes_supported`
 * (containing all four PackRat scopes), and `bearer_methods_supported`
 * (including `'header'`).
 */
export interface ProtectedResourceMetadataInput {
  rsUrl: string;
  asUrl: string;
  res: ProbeResponse;
}

export function checkProtectedResourceMetadata(input: ProtectedResourceMetadataInput): CheckResult {
  const { rsUrl, asUrl, res } = input;
  const name = 'protected_resource_metadata';
  const label = '3. RS /.well-known/oauth-protected-resource is well-formed';
  if (res.error) {
    return { name, label, status: 'fail', details: `fetch error: ${res.error}` };
  }
  if (res.status !== 200) {
    return { name, label, status: 'fail', details: `GET returned ${res.status} (expected 200)` };
  }
  let body: unknown;
  try {
    body = JSON.parse(res.bodyText);
  } catch (err) {
    return { name, label, status: 'fail', details: `invalid JSON: ${errMessage(err)}` };
  }
  if (!isObject(body)) {
    return { name, label, status: 'fail', details: 'body is not a JSON object' };
  }
  const meta = toRecord(body);
  // resource — must match the expected pattern.
  const expectedResource = `${rsUrl}/mcp`;
  if (!isString(meta.resource)) {
    return { name, label, status: 'fail', details: 'missing or non-string "resource"' };
  }
  // The metadata is hard-pinned to prod; on a non-prod --rs-url we still
  // expect the metadata's `resource` to advertise the prod canonical URL.
  // Accept either an exact match to the target's /mcp path or the canonical
  // production URL — the canonical path is the binding-truth.
  const canonicalProd = `${DEFAULT_RS_URL}/mcp`;
  if (meta.resource !== expectedResource && meta.resource !== canonicalProd) {
    return {
      name,
      label,
      status: 'fail',
      details: `resource "${meta.resource}" matches neither ${expectedResource} nor ${canonicalProd}`,
    };
  }
  // authorization_servers — array with ≥1 entry pointing at the AS.
  if (!Array.isArray(meta.authorization_servers) || meta.authorization_servers.length === 0) {
    return {
      name,
      label,
      status: 'fail',
      details: 'authorization_servers must be a non-empty array',
    };
  }
  const asEntries = meta.authorization_servers as unknown[];
  // Cross-reference check: at least one entry must point at the AS we're
  // about to probe (either the operator-supplied --as-url or the canonical
  // prod AS). Otherwise we'd silently probe the wrong host in check 4.
  const canonicalAs = DEFAULT_AS_URL;
  const asMatches = asEntries.some((entry) => entry === asUrl || entry === canonicalAs);
  if (!asMatches) {
    return {
      name,
      label,
      status: 'fail',
      details: `authorization_servers ${JSON.stringify(asEntries)} does not include ${asUrl} or ${canonicalAs}`,
    };
  }
  // scopes_supported — array containing all four PackRat scopes.
  if (!Array.isArray(meta.scopes_supported)) {
    return { name, label, status: 'fail', details: 'scopes_supported is not an array' };
  }
  const scopes = meta.scopes_supported as unknown[];
  const missing = REQUIRED_SCOPES.filter((s) => !scopes.includes(s));
  if (missing.length > 0) {
    return {
      name,
      label,
      status: 'fail',
      details: `scopes_supported missing: ${missing.join(', ')}`,
    };
  }
  // bearer_methods_supported — includes 'header'.
  if (
    !Array.isArray(meta.bearer_methods_supported) ||
    !(meta.bearer_methods_supported as unknown[]).includes('header')
  ) {
    return {
      name,
      label,
      status: 'fail',
      details: 'bearer_methods_supported must include "header"',
    };
  }
  return {
    name,
    label,
    status: 'pass',
    details: `resource=${meta.resource}, AS=${JSON.stringify(asEntries)}, scopes_supported has all 4 PackRat scopes`,
  };
}

/**
 * Check 4 — AS `/.well-known/oauth-authorization-server` (RFC 8414)
 * returns a valid JSON document with `code_challenge_methods_supported:
 * ["S256"]` (mandatory — MCP clients refuse to proceed without it), the
 * right grant types (`authorization_code`, `refresh_token`), and
 * `response_types` containing `code`. Post-refactor this lives on
 * `api.packrat.world`, NOT on the MCP worker.
 */
export function checkAuthorizationServerMetadata(res: ProbeResponse): CheckResult {
  const name = 'authorization_server_metadata';
  const label = '4. AS /.well-known/oauth-authorization-server has S256 + correct grants';
  if (res.error) {
    return { name, label, status: 'fail', details: `fetch error: ${res.error}` };
  }
  if (res.status !== 200) {
    return { name, label, status: 'fail', details: `GET returned ${res.status} (expected 200)` };
  }
  let body: unknown;
  try {
    body = JSON.parse(res.bodyText);
  } catch (err) {
    return { name, label, status: 'fail', details: `invalid JSON: ${errMessage(err)}` };
  }
  if (!isObject(body)) {
    return { name, label, status: 'fail', details: 'body is not a JSON object' };
  }
  const meta = toRecord(body);
  if (!Array.isArray(meta.code_challenge_methods_supported)) {
    return {
      name,
      label,
      status: 'fail',
      details: 'code_challenge_methods_supported is not an array',
    };
  }
  if (!(meta.code_challenge_methods_supported as unknown[]).includes('S256')) {
    return {
      name,
      label,
      status: 'fail',
      details: 'code_challenge_methods_supported must include "S256"',
    };
  }
  // Verify allowPlainCodeChallengeMethod: false took effect — if the AS
  // advertises "plain" in addition to S256, MCP clients may negotiate down
  // to it. The plan's R4 mandates S256-only.
  if ((meta.code_challenge_methods_supported as unknown[]).includes('plain')) {
    return {
      name,
      label,
      status: 'fail',
      details:
        'code_challenge_methods_supported advertises "plain" — should be S256-only (check allowPlainCodeChallengeMethod: false in auth/index.ts)',
    };
  }
  if (!Array.isArray(meta.grant_types_supported)) {
    return {
      name,
      label,
      status: 'fail',
      details: 'grant_types_supported is not an array',
    };
  }
  const grants = meta.grant_types_supported as unknown[];
  for (const required of ['authorization_code', 'refresh_token']) {
    if (!grants.includes(required)) {
      return {
        name,
        label,
        status: 'fail',
        details: `grant_types_supported missing "${required}"`,
      };
    }
  }
  if (
    !Array.isArray(meta.response_types_supported) ||
    !(meta.response_types_supported as unknown[]).includes('code')
  ) {
    return {
      name,
      label,
      status: 'fail',
      details: 'response_types_supported must include "code"',
    };
  }
  return { name, label, status: 'pass', details: 'S256 + auth_code/refresh + code response_type' };
}

/**
 * Check 5 — Pre-registered Claude client is recognised by the AS. The
 * `@better-auth/oauth-provider` plugin exposes no public client-list
 * endpoint and `allowDynamicClientRegistration: false`, so the only way
 * to verify pre-registration without admin credentials is to inspect the
 * `oauthClient` table directly (or re-run the seed script). This check
 * always WARNs and points at the seed script + runbook.
 */
export function checkClaudeClientRegistration(): CheckResult {
  return {
    name: 'claude_client_registration',
    label: '5. Pre-registered Claude client present in AS oauthClient table',
    status: 'warn',
    details:
      '@better-auth/oauth-provider exposes no public client-list endpoint. Verify manually by ' +
      're-running `cd packages/api && bun run db:seed:oauth-clients` (idempotent — no-op if ' +
      'already registered) or inspecting the oauthClient table directly. ' +
      'See docs/mcp/runbook.md § "Deprovision the legacy OAUTH_KV namespaces + DCR secret".',
  };
}

/**
 * Check 6 — Favicon at the OAuth domain returns 200 with the right
 * Content-Type and valid .ico magic bytes. Anthropic's domain-ownership
 * probe targets the MCP host (not the brand site), so a 404 here would
 * fail intake silently. Post-refactor the favicon still lives on the RS
 * (the MCP worker serves it from `packages/mcp/src/favicon.ts`).
 */
export function checkFaviconAtOauthDomain(res: ProbeResponse, body: Uint8Array): CheckResult {
  const name = 'favicon_oauth_domain';
  const label = '6. RS /favicon.ico has the right shape (domain-ownership probe target)';
  if (res.error) {
    return { name, label, status: 'fail', details: `fetch error: ${res.error}` };
  }
  if (res.status !== 200) {
    return { name, label, status: 'fail', details: `GET returned ${res.status} (expected 200)` };
  }
  const ct = (res.headers.get('content-type') ?? '').toLowerCase();
  if (!ct.includes('image/x-icon') && !ct.includes('image/vnd.microsoft.icon')) {
    return {
      name,
      label,
      status: 'fail',
      details: `Content-Type "${ct}" is not image/x-icon`,
    };
  }
  if (body.byteLength < 4) {
    return { name, label, status: 'fail', details: `body too short (${body.byteLength} bytes)` };
  }
  // .ico magic bytes: 00 00 01 00
  if (body[0] !== 0x00 || body[1] !== 0x00 || body[2] !== 0x01 || body[3] !== 0x00) {
    return {
      name,
      label,
      status: 'fail',
      details: `body does not start with .ico magic bytes (got ${[body[0], body[1], body[2], body[3]].map((b) => (b ?? 0).toString(16).padStart(2, '0')).join(' ')})`,
    };
  }
  return {
    name,
    label,
    status: 'pass',
    details: `200 image/x-icon, ${body.byteLength} bytes, magic bytes OK`,
  };
}

/**
 * Check 7 — Public docs page on the brand domain renders. We don't parse
 * the full DOM; we smoke-check that the page contains the three strings a
 * reviewer would expect on the MCP page: "PackRat", "Claude.ai", "scope".
 */
export function checkPublicDocsPage(res: ProbeResponse, requiredTerms: string[]): CheckResult {
  const name = 'public_docs_page';
  const label = '7. Public docs URL (packratai.com/mcp) renders';
  if (res.error) {
    return { name, label, status: 'fail', details: `fetch error: ${res.error}` };
  }
  if (res.status !== 200) {
    return { name, label, status: 'fail', details: `GET returned ${res.status} (expected 200)` };
  }
  const body = res.bodyText;
  const missing = requiredTerms.filter((term) => !body.toLowerCase().includes(term.toLowerCase()));
  if (missing.length > 0) {
    return {
      name,
      label,
      status: 'fail',
      details: `body missing required terms: ${missing.join(', ')}`,
    };
  }
  return {
    name,
    label,
    status: 'pass',
    details: `200 OK, body contains ${requiredTerms.join(', ')}`,
  };
}

/**
 * Check 8 — Privacy + Terms reachable on the brand domain AND contain
 * MCP-specific copy (not just generic legal boilerplate). A missing
 * MCP-specific section is an Anthropic immediate-reject cause.
 */
export function checkPrivacyAndTerms(
  privacyRes: ProbeResponse,
  termsRes: ProbeResponse,
): CheckResult {
  const name = 'privacy_and_terms';
  const label = '8. /privacy-policy and /terms-of-service include MCP-specific copy';
  for (const [pageName, res] of [
    ['privacy-policy', privacyRes],
    ['terms-of-service', termsRes],
  ] as const) {
    if (res.error) {
      return { name, label, status: 'fail', details: `${pageName} fetch error: ${res.error}` };
    }
    if (res.status !== 200) {
      return {
        name,
        label,
        status: 'fail',
        details: `${pageName} returned ${res.status} (expected 200)`,
      };
    }
    const lower = res.bodyText.toLowerCase();
    if (!lower.includes('mcp') && !lower.includes('connector')) {
      return {
        name,
        label,
        status: 'fail',
        details: `${pageName} body contains neither "MCP" nor "connector" — the MCP-specific section is missing`,
      };
    }
  }
  return { name, label, status: 'pass', details: 'both pages return 200 and reference MCP' };
}

/**
 * Check 9 — Support contact is resolvable from RS /health. The contact is
 * also printed so the operator can confirm it matches the listing.
 */
export function checkSupportContact(healthBody: unknown): CheckResult {
  const name = 'support_contact';
  const label = '9. RS /health advertises a support contact';
  if (!isObject(healthBody)) {
    return { name, label, status: 'fail', details: '/health body is not a JSON object' };
  }
  const support = toRecord(healthBody).support;
  if (!isString(support) || support.length === 0) {
    return { name, label, status: 'fail', details: '/health is missing a "support" field' };
  }
  if (!support.startsWith('mailto:')) {
    return {
      name,
      label,
      status: 'fail',
      details: `support contact is not a mailto: link (got "${support}")`,
    };
  }
  return { name, label, status: 'pass', details: `support=${support}` };
}

/**
 * Check 10 — RS /health returns `{ status: 'ok', probes: { ... } }` with
 * all probes green. A degraded surface fails with the per-probe outcomes
 * so an operator can see exactly which dependency tripped.
 */
export function checkHealthStatus(res: ProbeResponse): {
  result: CheckResult;
  body: unknown;
} {
  const name = 'health_status';
  const label = '10. RS /health returns status: ok with all probes green';
  if (res.error) {
    return {
      result: { name, label, status: 'fail', details: `fetch error: ${res.error}` },
      body: null,
    };
  }
  if (res.status !== 200) {
    return {
      result: {
        name,
        label,
        status: 'fail',
        details: `GET /health returned ${res.status} (expected 200; non-200 means degraded)`,
      },
      body: null,
    };
  }
  let body: unknown;
  try {
    body = JSON.parse(res.bodyText);
  } catch (err) {
    return {
      result: { name, label, status: 'fail', details: `invalid JSON: ${errMessage(err)}` },
      body: null,
    };
  }
  if (!isObject(body)) {
    return {
      result: { name, label, status: 'fail', details: 'body is not a JSON object' },
      body,
    };
  }
  const obj = toRecord(body);
  if (obj.status !== 'ok') {
    const probes = isObject(obj.probes) ? JSON.stringify(obj.probes) : '<no probes field>';
    return {
      result: {
        name,
        label,
        status: 'fail',
        details: `status=${String(obj.status)}, probes=${probes}`,
      },
      body,
    };
  }
  return {
    result: { name, label, status: 'pass', details: 'status=ok, probes all green' },
    body,
  };
}

/**
 * Check 10b — RS /status advertises scopes_supported, used as a sanity
 * cross-check that the deployed worker matches the metadata we expect.
 */
export function checkStatusEndpoint(res: ProbeResponse): CheckResult {
  const name = 'status_endpoint';
  const label = '10b. RS /status advertises scopes_supported';
  if (res.error) {
    return { name, label, status: 'fail', details: `fetch error: ${res.error}` };
  }
  if (res.status !== 200) {
    return { name, label, status: 'fail', details: `GET /status returned ${res.status}` };
  }
  let body: unknown;
  try {
    body = JSON.parse(res.bodyText);
  } catch (err) {
    return { name, label, status: 'fail', details: `invalid JSON: ${errMessage(err)}` };
  }
  if (!isObject(body)) {
    return { name, label, status: 'fail', details: 'body is not a JSON object' };
  }
  const scopes = toRecord(body).scopes_supported;
  if (!Array.isArray(scopes)) {
    return { name, label, status: 'fail', details: 'scopes_supported is not an array' };
  }
  const missing = REQUIRED_SCOPES.filter((s) => !(scopes as unknown[]).includes(s));
  if (missing.length > 0) {
    return {
      name,
      label,
      status: 'fail',
      details: `scopes_supported missing: ${missing.join(', ')}`,
    };
  }
  return { name, label, status: 'pass', details: 'scopes_supported has all 4 PackRat scopes' };
}

/**
 * Check 11 — Every tool in the catalog has `title`, `readOnlyHint`
 * explicitly set, and (for non-read-only tools) `destructiveHint`
 * explicitly set. This is Anthropic's #1 published rejection cause.
 */
export interface CatalogTool {
  name: string;
  title?: unknown;
  description?: unknown;
  annotations?: {
    readOnlyHint?: unknown;
    destructiveHint?: unknown;
    idempotentHint?: unknown;
    openWorldHint?: unknown;
  };
}

export interface Catalog {
  tools: CatalogTool[];
  totalTools?: number;
}

export function checkToolAnnotations(catalog: Catalog | null, source: string): CheckResult {
  const name = 'tool_annotations';
  const label = '11. Every tool has title + readOnlyHint + destructiveHint (when applicable)';
  if (!catalog) {
    return { name, label, status: 'fail', details: `catalog not loaded (source: ${source})` };
  }
  if (!Array.isArray(catalog.tools) || catalog.tools.length === 0) {
    return { name, label, status: 'fail', details: `catalog has no tools (source: ${source})` };
  }
  const offenders: string[] = [];
  for (const tool of catalog.tools) {
    const issues: string[] = [];
    if (!isString(tool.title) || tool.title.length === 0) {
      issues.push('title');
    }
    const ann = tool.annotations ?? {};
    if (!isBoolean(ann.readOnlyHint)) {
      issues.push('readOnlyHint');
    } else if (ann.readOnlyHint === false && !isBoolean(ann.destructiveHint)) {
      issues.push('destructiveHint');
    }
    if (issues.length > 0) {
      offenders.push(`${tool.name}: missing ${issues.join(', ')}`);
    }
  }
  if (offenders.length > 0) {
    return {
      name,
      label,
      status: 'fail',
      details: `${offenders.length} tool(s) with annotation gaps: ${offenders.slice(0, 3).join(' | ')}${offenders.length > 3 ? ` (+${offenders.length - 3} more)` : ''}`,
    };
  }
  return {
    name,
    label,
    status: 'pass',
    details: `all ${catalog.tools.length} tools have title + complete annotations`,
  };
}

/**
 * Check 12 — Tool descriptions are non-promotional. Scans every
 * description for the FORBIDDEN_PROMO_PATTERNS list and flags matches.
 */
export function checkToolDescriptionsNonPromotional(catalog: Catalog | null): CheckResult {
  const name = 'tool_descriptions_non_promotional';
  const label = '12. Tool descriptions free of forbidden marketing words';
  if (!catalog || !Array.isArray(catalog.tools)) {
    return { name, label, status: 'fail', details: 'catalog not loaded' };
  }
  const flagged: string[] = [];
  for (const tool of catalog.tools) {
    if (!isString(tool.description)) continue;
    for (const { pattern, label: word } of FORBIDDEN_PROMO_PATTERNS) {
      if (pattern.test(tool.description)) {
        flagged.push(`${tool.name}: contains "${word}"`);
      }
    }
  }
  if (flagged.length > 0) {
    return {
      name,
      label,
      status: 'fail',
      details: `${flagged.length} description(s) flagged: ${flagged.slice(0, 3).join(' | ')}${flagged.length > 3 ? ` (+${flagged.length - 3} more)` : ''}`,
    };
  }
  return {
    name,
    label,
    status: 'pass',
    details: `${catalog.tools.length} descriptions scanned, none flagged`,
  };
}

// ── Catalog loader ────────────────────────────────────────────────────────

export async function loadCatalog(
  overridePath: string | null,
): Promise<{ catalog: Catalog | null; source: string }> {
  const candidates: string[] = [];
  if (overridePath) candidates.push(overridePath);
  // Default: try the dumped catalog in the landing app.
  const here = dirname(fileURLToPath(import.meta.url));
  candidates.push(resolve(here, '../../../apps/landing/data/mcp-catalog.json'));
  for (const path of candidates) {
    try {
      const text = await readFile(path, 'utf8');
      const parsed = JSON.parse(text);
      if (parsed && Array.isArray(parsed.tools)) {
        // safe-cast: shape is asserted above (tools is an array); the Catalog interface's
        // tool fields are all `unknown`, so downstream checks (checkToolAnnotations etc.)
        // validate each field with @packrat/guards before use.
        return { catalog: parsed as Catalog, source: path };
      }
      return { catalog: null, source: `${path} (no tools array)` };
    } catch (err) {
      // Node's fs error objects expose `.code` via NodeJS.ErrnoException.
      // Error instances aren't plain objects, so read `.code` via a typed
      // narrowing rather than `as NodeJS.ErrnoException`.
      const code = err instanceof Error ? (err as Error & { code?: string }).code : undefined; // safe-cast: NodeJS.ErrnoException is just `Error & { code, errno, ... }` — `.code` is the only field we read
      if (code !== 'ENOENT') {
        return {
          catalog: null,
          source: `${path} (load error: ${errMessage(err)})`,
        };
      }
    }
  }
  return { catalog: null, source: `not found in: ${candidates.join(', ')}` };
}

// ── Runner ────────────────────────────────────────────────────────────────

export interface RunOptions {
  rsUrl?: string;
  asUrl?: string;
  brandDomain?: string;
  catalogPath?: string | null;
  fetchImpl?: typeof fetch;
}

/**
 * Pure runner — no console output, no process.exit. Returns the report so
 * callers (CLI, unit tests, CI) can format it however they need.
 */
export async function runReadinessChecks(opts: RunOptions = {}): Promise<ReadinessReport> {
  const rsUrl = stripTrailingSlash(opts.rsUrl ?? DEFAULT_RS_URL);
  const asUrl = stripTrailingSlash(opts.asUrl ?? DEFAULT_AS_URL);
  const brandDomain = stripTrailingSlash(opts.brandDomain ?? DEFAULT_BRAND_DOMAIN);
  const fetchImpl = opts.fetchImpl ?? globalThis.fetch;

  // Issue the network probes in parallel where independent. Note the
  // host split: PRM + WWW-Authenticate + /health + /status + favicon all
  // live on the RS; AS metadata lives on the AS; docs + privacy + terms
  // live on the brand domain.
  const [
    rootRes,
    mcpRes,
    protectedResourceRes,
    asMetaRes,
    faviconRes,
    docsRes,
    privacyRes,
    termsRes,
    healthRes,
    statusRes,
  ] = await Promise.all([
    probe({ url: `${rsUrl}/`, init: { method: 'GET' }, fetchImpl }),
    probe({
      url: `${rsUrl}/mcp`,
      init: { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' },
      fetchImpl,
    }),
    probe({
      url: `${rsUrl}/.well-known/oauth-protected-resource`,
      init: { method: 'GET' },
      fetchImpl,
    }),
    probe({
      url: `${asUrl}/.well-known/oauth-authorization-server`,
      init: { method: 'GET' },
      fetchImpl,
    }),
    probe({ url: `${rsUrl}/favicon.ico`, init: { method: 'GET' }, fetchImpl }),
    probe({ url: `${brandDomain}/mcp`, init: { method: 'GET' }, fetchImpl }),
    probe({ url: `${brandDomain}/privacy-policy`, init: { method: 'GET' }, fetchImpl }),
    probe({ url: `${brandDomain}/terms-of-service`, init: { method: 'GET' }, fetchImpl }),
    probe({ url: `${rsUrl}/health`, init: { method: 'GET' }, fetchImpl }),
    probe({ url: `${rsUrl}/status`, init: { method: 'GET' }, fetchImpl }),
  ]);

  // Catalog is filesystem-backed; load it in parallel with the network.
  const { catalog, source: catalogSource } = await loadCatalog(opts.catalogPath ?? null);

  // Re-fetch favicon as raw bytes for magic-byte inspection. (probe()'s
  // .text() decode would mangle .ico binary content; this is the one
  // surface that needs a real ArrayBuffer.)
  let faviconBody = new Uint8Array(0);
  if (faviconRes.status === 200) {
    try {
      const raw = await fetchImpl(`${rsUrl}/favicon.ico`, { method: 'GET' });
      faviconBody = new Uint8Array(await raw.arrayBuffer());
    } catch {
      // Leave faviconBody empty — checkFaviconAtOauthDomain will FAIL.
    }
  }

  const checks: CheckResult[] = [];
  checks.push(checkTlsReachability(rsUrl, rootRes));
  checks.push(checkStreamableHttpAuth(mcpRes));
  checks.push(checkProtectedResourceMetadata({ rsUrl, asUrl, res: protectedResourceRes }));
  checks.push(checkAuthorizationServerMetadata(asMetaRes));
  checks.push(checkClaudeClientRegistration());
  checks.push(checkFaviconAtOauthDomain(faviconRes, faviconBody));
  checks.push(checkPublicDocsPage(docsRes, ['PackRat', 'Claude.ai', 'scope']));
  checks.push(checkPrivacyAndTerms(privacyRes, termsRes));

  const healthCheck = checkHealthStatus(healthRes);
  checks.push(checkSupportContact(healthCheck.body));
  checks.push(healthCheck.result);
  checks.push(checkStatusEndpoint(statusRes));
  checks.push(checkToolAnnotations(catalog, catalogSource));
  checks.push(checkToolDescriptionsNonPromotional(catalog));

  const summary = summarize(checks);
  return { rsUrl, asUrl, brandDomain, checks, summary };
}

export function summarize(checks: CheckResult[]): ReadinessSummary {
  let passed = 0;
  let failed = 0;
  let warned = 0;
  for (const c of checks) {
    if (c.status === 'pass') passed++;
    else if (c.status === 'fail') failed++;
    else warned++;
  }
  return { passed, failed, warned, total: checks.length };
}

// ── Formatters ────────────────────────────────────────────────────────────

export function formatReport(report: ReadinessReport): string {
  const lines: string[] = [];
  lines.push(
    colorize(`PackRat MCP submission readiness — RS: ${report.rsUrl}, AS: ${report.asUrl}`, 'bold'),
  );
  lines.push(colorize(`Brand domain: ${report.brandDomain}`, 'dim'));
  lines.push('');
  for (const check of report.checks) {
    const glyph = colorize(STATUS_GLYPH[check.status], STATUS_COLOR[check.status]);
    lines.push(`  ${glyph}  ${check.label}`);
    lines.push(colorize(`      ${check.details}`, 'dim'));
  }
  lines.push('');
  const summary = `${report.summary.passed}/${report.summary.total} passed`;
  const summaryColor: keyof typeof ANSI =
    report.summary.failed === 0 ? (report.summary.warned === 0 ? 'green' : 'yellow') : 'red';
  lines.push(colorize(summary, summaryColor));
  if (report.summary.warned > 0) {
    lines.push(colorize(`(${report.summary.warned} warned — see notes above)`, 'yellow'));
  }
  return lines.join('\n');
}

export function formatJsonReport(report: ReadinessReport): string {
  return JSON.stringify(
    {
      rsUrl: report.rsUrl,
      asUrl: report.asUrl,
      brandDomain: report.brandDomain,
      checks: report.checks.map((c) => ({
        name: c.name,
        label: c.label,
        status: c.status,
        details: c.details,
      })),
      summary: report.summary,
    },
    null,
    2,
  );
}

// ── Main ──────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  let args: CliArgs;
  try {
    args = parseArgs(process.argv.slice(2));
  } catch (err) {
    console.error(`Error: ${errMessage(err)}\n`);
    printHelp();
    process.exit(2);
  }
  if (args.help) {
    printHelp();
    return;
  }

  const report = await runReadinessChecks({
    rsUrl: args.rsUrl,
    asUrl: args.asUrl,
    brandDomain: args.brandDomain,
    catalogPath: args.catalogPath,
  });

  if (args.json) {
    console.log(formatJsonReport(report));
  } else {
    console.log(formatReport(report));
  }

  process.exit(report.summary.failed > 0 ? 1 : 0);
}

// Only run main() when invoked as a script (not when imported by tests).
if (import.meta.main) {
  main().catch((err) => {
    console.error(`Error: ${errMessage(err)}`);
    process.exit(1);
  });
}
