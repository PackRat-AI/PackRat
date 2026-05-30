/**
 * U18 + U7 refactor: unit tests for the submission-readiness check
 * primitives.
 *
 * The script in `packages/mcp/scripts/submission-readiness.ts` is a runtime
 * probe — it cannot be exercised against a real deployed worker in CI
 * before the deploy itself happens. These tests instead lock in the check
 * primitives' shape: every helper is pure (input -> CheckResult), so we
 * can feed it fixture responses and assert PASS / FAIL / WARN classifies
 * exactly as advertised in the operator-facing line of the runbook.
 *
 * Post-refactor (U7) the script targets two distinct origins:
 *   - RS_TARGET = mcp.packratai.com  (the protected resource)
 *   - AS_TARGET = api.packrat.world  (the OAuth authorization server)
 * The DCR gate check is gone (DCR is disabled at the AS via
 * `allowDynamicClientRegistration: false`; no /register endpoint exists
 * to probe). The pre-registered Claude client probe is now an
 * unconditional WARN that points operators at the seed script.
 *
 * If a CheckResult shape ever drifts (e.g. a new `severity` field is
 * added, or a status string is renamed), this suite fails loudly so the
 * formatter, the CI workflow, and the runbook can be updated in lockstep.
 */

import { describe, expect, it } from 'vitest';
import {
  type Catalog,
  checkAuthorizationServerMetadata,
  checkClaudeClientRegistration,
  checkFaviconAtOauthDomain,
  checkHealthStatus,
  checkPrivacyAndTerms,
  checkProtectedResourceMetadata,
  checkPublicDocsPage,
  checkStatusEndpoint,
  checkStreamableHttpAuth,
  checkSupportContact,
  checkTlsReachability,
  checkToolAnnotations,
  checkToolDescriptionsNonPromotional,
  DEFAULT_AS_URL,
  DEFAULT_RS_URL,
  FORBIDDEN_PROMO_PATTERNS,
  type ProbeResponse,
  parseArgs,
  REQUIRED_SCOPES,
  summarize,
} from '../../scripts/submission-readiness';

const RS_TARGET = DEFAULT_RS_URL;
const AS_TARGET = DEFAULT_AS_URL;

function makeRes(overrides: Partial<ProbeResponse> & { url?: string } = {}): ProbeResponse {
  return {
    ok: true,
    status: 200,
    headers: new Headers(),
    bodyText: '',
    url: overrides.url ?? `${RS_TARGET}/`,
    ...overrides,
  };
}

// ── parseArgs ─────────────────────────────────────────────────────────────

describe('parseArgs', () => {
  it('returns defaults when no args are given', () => {
    const args = parseArgs([]);
    expect(args.rsUrl).toBe(DEFAULT_RS_URL);
    expect(args.asUrl).toBe(DEFAULT_AS_URL);
    expect(args.json).toBe(false);
    expect(args.help).toBe(false);
    expect(args.catalogPath).toBeNull();
  });

  it('parses --rs-url and strips a trailing slash', () => {
    const args = parseArgs(['--rs-url', 'https://staging-mcp.example.com/']);
    expect(args.rsUrl).toBe('https://staging-mcp.example.com');
  });

  it('parses --as-url and strips a trailing slash', () => {
    const args = parseArgs(['--as-url', 'https://staging-api.example.com/']);
    expect(args.asUrl).toBe('https://staging-api.example.com');
  });

  it('parses --rs-url and --as-url together', () => {
    const args = parseArgs([
      '--rs-url',
      'https://staging-mcp.example.com',
      '--as-url',
      'https://staging-api.example.com',
    ]);
    expect(args.rsUrl).toBe('https://staging-mcp.example.com');
    expect(args.asUrl).toBe('https://staging-api.example.com');
  });

  it('rejects the legacy --url flag with a guidance error', () => {
    expect(() => parseArgs(['--url', 'https://example.com'])).toThrow(/--url is no longer/);
  });

  it('parses --json', () => {
    expect(parseArgs(['--json']).json).toBe(true);
  });

  it('parses --catalog', () => {
    const args = parseArgs(['--catalog', '/tmp/catalog.json']);
    expect(args.catalogPath).toBe('/tmp/catalog.json');
  });

  it('throws on unknown args', () => {
    expect(() => parseArgs(['--bogus'])).toThrow(/Unknown argument/);
  });

  it('throws when a flag is missing its value', () => {
    expect(() => parseArgs(['--rs-url'])).toThrow(/--rs-url requires a value/);
  });
});

// ── checkTlsReachability ──────────────────────────────────────────────────

describe('checkTlsReachability', () => {
  it('fails when the target URL is not HTTPS', () => {
    const res = makeRes({ url: 'http://example.com/' });
    const result = checkTlsReachability({ targetUrl: 'http://example.com', res });
    expect(result.status).toBe('fail');
    expect(result.details).toMatch(/not HTTPS/);
  });

  it('fails when the fetch errored out', () => {
    const res = makeRes({ ok: false, status: 0, error: 'ECONNREFUSED' });
    expect(checkTlsReachability({ targetUrl: RS_TARGET, res }).status).toBe('fail');
  });

  it('fails when the status is not 200', () => {
    const res = makeRes({ ok: false, status: 503 });
    expect(checkTlsReachability({ targetUrl: RS_TARGET, res }).status).toBe('fail');
  });

  it('fails when the response URL host drifts from the target', () => {
    const res = makeRes({ url: 'https://other.example.com/' });
    expect(checkTlsReachability({ targetUrl: RS_TARGET, res }).status).toBe('fail');
  });

  it('passes on 200 + matching host', () => {
    const res = makeRes({ url: `${RS_TARGET}/`, status: 200 });
    expect(checkTlsReachability({ targetUrl: RS_TARGET, res }).status).toBe('pass');
  });
});

// ── checkStreamableHttpAuth ───────────────────────────────────────────────

describe('checkStreamableHttpAuth', () => {
  it('fails on non-401 status (catches 404 / 500 silent breaks)', () => {
    expect(checkStreamableHttpAuth(makeRes({ status: 404 })).status).toBe('fail');
    expect(checkStreamableHttpAuth(makeRes({ status: 500 })).status).toBe('fail');
  });

  it('fails when WWW-Authenticate is missing', () => {
    const res = makeRes({ status: 401 });
    expect(checkStreamableHttpAuth(res).status).toBe('fail');
  });

  it('fails when WWW-Authenticate lacks resource_metadata', () => {
    const res = makeRes({
      status: 401,
      headers: new Headers({ 'WWW-Authenticate': 'Bearer realm="mcp"' }),
    });
    expect(checkStreamableHttpAuth(res).status).toBe('fail');
  });

  it('fails when WWW-Authenticate lacks scope', () => {
    const res = makeRes({
      status: 401,
      headers: new Headers({
        'WWW-Authenticate': 'Bearer resource_metadata="https://x/.well-known/x"',
      }),
    });
    expect(checkStreamableHttpAuth(res).status).toBe('fail');
  });

  it('passes on 401 + resource_metadata + scope', () => {
    const res = makeRes({
      status: 401,
      headers: new Headers({
        'WWW-Authenticate':
          'Bearer resource_metadata="https://mcp.packratai.com/.well-known/oauth-protected-resource", scope="mcp"',
      }),
    });
    expect(checkStreamableHttpAuth(res).status).toBe('pass');
  });
});

// ── checkProtectedResourceMetadata ────────────────────────────────────────

describe('checkProtectedResourceMetadata', () => {
  const happyBody = {
    resource: `${RS_TARGET}/mcp`,
    // Post-refactor the AS lives on a different origin from the RS.
    authorization_servers: [AS_TARGET],
    scopes_supported: [...REQUIRED_SCOPES],
    bearer_methods_supported: ['header'],
    resource_name: 'PackRat MCP',
  };

  it('fails when the JSON is invalid', () => {
    const res = makeRes({ status: 200, bodyText: 'not json' });
    expect(checkProtectedResourceMetadata({ rsUrl: RS_TARGET, asUrl: AS_TARGET, res }).status).toBe(
      'fail',
    );
  });

  it('fails when scopes_supported is missing one of the required four', () => {
    const body = { ...happyBody, scopes_supported: ['mcp', 'mcp:read', 'mcp:write'] };
    const res = makeRes({ status: 200, bodyText: JSON.stringify(body) });
    const result = checkProtectedResourceMetadata({ rsUrl: RS_TARGET, asUrl: AS_TARGET, res });
    expect(result.status).toBe('fail');
    expect(result.details).toMatch(/mcp:admin/);
  });

  it('fails when bearer_methods_supported lacks "header"', () => {
    const body = { ...happyBody, bearer_methods_supported: ['query'] };
    const res = makeRes({ status: 200, bodyText: JSON.stringify(body) });
    expect(checkProtectedResourceMetadata({ rsUrl: RS_TARGET, asUrl: AS_TARGET, res }).status).toBe(
      'fail',
    );
  });

  it('fails when authorization_servers is empty', () => {
    const body = { ...happyBody, authorization_servers: [] };
    const res = makeRes({ status: 200, bodyText: JSON.stringify(body) });
    expect(checkProtectedResourceMetadata({ rsUrl: RS_TARGET, asUrl: AS_TARGET, res }).status).toBe(
      'fail',
    );
  });

  it('fails when authorization_servers points at the wrong host (cross-reference guard)', () => {
    const body = { ...happyBody, authorization_servers: ['https://wrong-host.example.com'] };
    const res = makeRes({ status: 200, bodyText: JSON.stringify(body) });
    const result = checkProtectedResourceMetadata({ rsUrl: RS_TARGET, asUrl: AS_TARGET, res });
    expect(result.status).toBe('fail');
    expect(result.details).toMatch(/wrong-host\.example\.com/);
  });

  it('passes on a well-formed metadata document with the cross-origin AS', () => {
    const res = makeRes({ status: 200, bodyText: JSON.stringify(happyBody) });
    expect(checkProtectedResourceMetadata({ rsUrl: RS_TARGET, asUrl: AS_TARGET, res }).status).toBe(
      'pass',
    );
  });

  it('accepts the canonical prod resource URL even when probing a different --rs-url', () => {
    // The metadata is hard-pinned to prod per metadata.ts — so a staging
    // worker that still advertises the prod URL is fine.
    const stagingRs = 'https://staging-mcp.example.com';
    const res = makeRes({ status: 200, bodyText: JSON.stringify(happyBody) });
    expect(checkProtectedResourceMetadata({ rsUrl: stagingRs, asUrl: AS_TARGET, res }).status).toBe(
      'pass',
    );
  });

  it('accepts the canonical prod AS even when probing a different --as-url', () => {
    // Same hard-pinning argument for the cross-reference: a staging RS
    // can legitimately advertise the prod AS in its metadata.
    const stagingAs = 'https://staging-api.example.com';
    const res = makeRes({ status: 200, bodyText: JSON.stringify(happyBody) });
    expect(checkProtectedResourceMetadata({ rsUrl: RS_TARGET, asUrl: stagingAs, res }).status).toBe(
      'pass',
    );
  });
});

// ── checkAuthorizationServerMetadata ──────────────────────────────────────

describe('checkAuthorizationServerMetadata', () => {
  const happyBody = {
    // Post-refactor the AS lives on api.packrat.world; the issuer claim
    // MUST match the URL it's fetched from.
    issuer: AS_TARGET,
    code_challenge_methods_supported: ['S256'],
    grant_types_supported: ['authorization_code', 'refresh_token'],
    response_types_supported: ['code'],
  };

  it('fails when S256 is missing', () => {
    const body = { ...happyBody, code_challenge_methods_supported: ['plain'] };
    const res = makeRes({
      status: 200,
      bodyText: JSON.stringify(body),
      url: `${AS_TARGET}/.well-known/oauth-authorization-server`,
    });
    const result = checkAuthorizationServerMetadata(res);
    expect(result.status).toBe('fail');
    expect(result.details).toMatch(/S256/);
  });

  it('fails when "plain" is advertised alongside S256 (allowPlainCodeChallengeMethod regression)', () => {
    const body = { ...happyBody, code_challenge_methods_supported: ['S256', 'plain'] };
    const res = makeRes({
      status: 200,
      bodyText: JSON.stringify(body),
      url: `${AS_TARGET}/.well-known/oauth-authorization-server`,
    });
    const result = checkAuthorizationServerMetadata(res);
    expect(result.status).toBe('fail');
    expect(result.details).toMatch(/plain/);
  });

  it('fails when refresh_token grant is missing', () => {
    const body = { ...happyBody, grant_types_supported: ['authorization_code'] };
    const res = makeRes({
      status: 200,
      bodyText: JSON.stringify(body),
      url: `${AS_TARGET}/.well-known/oauth-authorization-server`,
    });
    expect(checkAuthorizationServerMetadata(res).status).toBe('fail');
  });

  it('fails when response_types_supported lacks "code"', () => {
    const body = { ...happyBody, response_types_supported: ['token'] };
    const res = makeRes({
      status: 200,
      bodyText: JSON.stringify(body),
      url: `${AS_TARGET}/.well-known/oauth-authorization-server`,
    });
    expect(checkAuthorizationServerMetadata(res).status).toBe('fail');
  });

  it('passes on a well-formed AS metadata document fetched from the AS host', () => {
    const res = makeRes({
      status: 200,
      bodyText: JSON.stringify(happyBody),
      url: `${AS_TARGET}/.well-known/oauth-authorization-server`,
    });
    expect(checkAuthorizationServerMetadata(res).status).toBe('pass');
  });
});

// ── checkClaudeClientRegistration ─────────────────────────────────────────

describe('checkClaudeClientRegistration', () => {
  it('always WARNs and points at the seed script (no public list endpoint)', () => {
    const result = checkClaudeClientRegistration();
    expect(result.status).toBe('warn');
    expect(result.details).toMatch(/db:seed:oauth-clients/);
  });
});

// ── checkFaviconAtOauthDomain ─────────────────────────────────────────────

describe('checkFaviconAtOauthDomain', () => {
  const validIco = new Uint8Array([0x00, 0x00, 0x01, 0x00, 0xde, 0xad, 0xbe, 0xef]);

  it('fails on non-200', () => {
    expect(
      checkFaviconAtOauthDomain({ res: makeRes({ status: 404 }), body: validIco }).status,
    ).toBe('fail');
  });

  it('fails when Content-Type is not image/x-icon', () => {
    const res = makeRes({
      status: 200,
      headers: new Headers({ 'Content-Type': 'text/html' }),
    });
    expect(checkFaviconAtOauthDomain({ res, body: validIco }).status).toBe('fail');
  });

  it('fails when the body lacks .ico magic bytes', () => {
    const badIco = new Uint8Array([0x00, 0x00, 0x00, 0x00]);
    const res = makeRes({
      status: 200,
      headers: new Headers({ 'Content-Type': 'image/x-icon' }),
    });
    expect(checkFaviconAtOauthDomain({ res, body: badIco }).status).toBe('fail');
  });

  it('fails when the body is too short', () => {
    const res = makeRes({
      status: 200,
      headers: new Headers({ 'Content-Type': 'image/x-icon' }),
    });
    expect(checkFaviconAtOauthDomain({ res, body: new Uint8Array(0) }).status).toBe('fail');
  });

  it('passes on 200 + image/x-icon + magic bytes', () => {
    const res = makeRes({
      status: 200,
      headers: new Headers({ 'Content-Type': 'image/x-icon' }),
    });
    expect(checkFaviconAtOauthDomain({ res, body: validIco }).status).toBe('pass');
  });

  it('also accepts image/vnd.microsoft.icon (RFC 2361 alternate)', () => {
    const res = makeRes({
      status: 200,
      headers: new Headers({ 'Content-Type': 'image/vnd.microsoft.icon' }),
    });
    expect(checkFaviconAtOauthDomain({ res, body: validIco }).status).toBe('pass');
  });
});

// ── checkPublicDocsPage ───────────────────────────────────────────────────

describe('checkPublicDocsPage', () => {
  it('fails when the page does not contain a required term', () => {
    const res = makeRes({ status: 200, bodyText: '<html><body>foo</body></html>' });
    const result = checkPublicDocsPage({ res, requiredTerms: ['PackRat', 'Claude.ai'] });
    expect(result.status).toBe('fail');
    expect(result.details).toMatch(/PackRat/);
  });

  it('fails on non-200', () => {
    expect(
      checkPublicDocsPage({ res: makeRes({ status: 404 }), requiredTerms: ['PackRat'] }).status,
    ).toBe('fail');
  });

  it('passes when every required term is present (case-insensitive)', () => {
    const body = 'Welcome to PackRat. Connect via claude.ai using the mcp:read scope.';
    const res = makeRes({ status: 200, bodyText: body });
    expect(
      checkPublicDocsPage({ res, requiredTerms: ['PackRat', 'Claude.ai', 'scope'] }).status,
    ).toBe('pass');
  });
});

// ── checkPrivacyAndTerms ──────────────────────────────────────────────────

describe('checkPrivacyAndTerms', () => {
  const privacyBody = '...MCP connector section...';
  const termsBody = '...connector-related terms...';

  it('fails when privacy lacks MCP-specific copy', () => {
    const privacy = makeRes({ status: 200, bodyText: 'generic privacy text' });
    const terms = makeRes({ status: 200, bodyText: termsBody });
    expect(checkPrivacyAndTerms({ privacyRes: privacy, termsRes: terms }).status).toBe('fail');
  });

  it('fails when terms returns non-200', () => {
    const privacy = makeRes({ status: 200, bodyText: privacyBody });
    const terms = makeRes({ status: 404 });
    expect(checkPrivacyAndTerms({ privacyRes: privacy, termsRes: terms }).status).toBe('fail');
  });

  it('passes when both pages return 200 and reference MCP/connector', () => {
    const privacy = makeRes({ status: 200, bodyText: privacyBody });
    const terms = makeRes({ status: 200, bodyText: termsBody });
    expect(checkPrivacyAndTerms({ privacyRes: privacy, termsRes: terms }).status).toBe('pass');
  });
});

// ── checkSupportContact / checkHealthStatus / checkStatusEndpoint ─────────

describe('checkSupportContact', () => {
  it('fails when /health body is not an object', () => {
    expect(checkSupportContact(null).status).toBe('fail');
  });

  it('fails when support field is missing', () => {
    expect(checkSupportContact({ status: 'ok' }).status).toBe('fail');
  });

  it('fails when support is not a mailto:', () => {
    expect(checkSupportContact({ support: 'https://x.example.com' }).status).toBe('fail');
  });

  it('passes on a mailto: support contact', () => {
    const result = checkSupportContact({ support: 'mailto:hello@packratai.com' });
    expect(result.status).toBe('pass');
    expect(result.details).toMatch(/hello@packratai\.com/);
  });
});

describe('checkHealthStatus', () => {
  it('fails on non-200 with the per-probe outcomes', () => {
    const res = makeRes({
      status: 503,
      bodyText: JSON.stringify({
        status: 'degraded',
        probes: { kv: 'ok', api: 'down' },
      }),
    });
    const { result } = checkHealthStatus(res);
    expect(result.status).toBe('fail');
  });

  it('fails when status is not "ok", surfacing the probes JSON', () => {
    const res = makeRes({
      status: 200,
      bodyText: JSON.stringify({
        status: 'degraded',
        probes: { kv: 'ok', api: 'down' },
      }),
    });
    const { result } = checkHealthStatus(res);
    expect(result.status).toBe('fail');
    expect(result.details).toMatch(/api/);
  });

  it('passes when status is ok', () => {
    const body = {
      status: 'ok',
      support: 'mailto:hello@packratai.com',
      probes: { kv: 'ok', api: 'ok' },
    };
    const res = makeRes({ status: 200, bodyText: JSON.stringify(body) });
    const { result, body: parsed } = checkHealthStatus(res);
    expect(result.status).toBe('pass');
    expect(parsed).toMatchObject({ status: 'ok' });
  });
});

describe('checkStatusEndpoint', () => {
  it('fails when scopes_supported is missing a required scope', () => {
    const res = makeRes({
      status: 200,
      bodyText: JSON.stringify({ scopes_supported: ['mcp', 'mcp:read', 'mcp:write'] }),
    });
    expect(checkStatusEndpoint(res).status).toBe('fail');
  });

  it('passes when scopes_supported contains all four PackRat scopes', () => {
    const res = makeRes({
      status: 200,
      bodyText: JSON.stringify({ scopes_supported: [...REQUIRED_SCOPES] }),
    });
    expect(checkStatusEndpoint(res).status).toBe('pass');
  });
});

// ── checkToolAnnotations ──────────────────────────────────────────────────

describe('checkToolAnnotations', () => {
  it('fails when the catalog is missing', () => {
    expect(checkToolAnnotations({ catalog: null, source: 'nowhere' }).status).toBe('fail');
  });

  it('flags a tool that lacks a title', () => {
    const catalog: Catalog = {
      tools: [
        {
          name: 'packrat_get_pack',
          // title omitted intentionally
          annotations: { readOnlyHint: true },
        },
      ],
    };
    const result = checkToolAnnotations({ catalog, source: 'fixture' });
    expect(result.status).toBe('fail');
    expect(result.details).toMatch(/title/);
  });

  it('flags a non-readonly tool that lacks destructiveHint', () => {
    const catalog: Catalog = {
      tools: [
        {
          name: 'packrat_delete_pack',
          title: 'Delete Pack',
          annotations: { readOnlyHint: false /* destructiveHint omitted */ },
        },
      ],
    };
    expect(checkToolAnnotations({ catalog, source: 'fixture' }).status).toBe('fail');
  });

  it('passes when every tool has title + readOnlyHint (and destructiveHint when needed)', () => {
    const catalog: Catalog = {
      tools: [
        {
          name: 'packrat_get_pack',
          title: 'Get Pack',
          annotations: { readOnlyHint: true },
        },
        {
          name: 'packrat_delete_pack',
          title: 'Delete Pack',
          annotations: { readOnlyHint: false, destructiveHint: true },
        },
      ],
    };
    expect(checkToolAnnotations({ catalog, source: 'fixture' }).status).toBe('pass');
  });
});

// ── checkToolDescriptionsNonPromotional ───────────────────────────────────

describe('checkToolDescriptionsNonPromotional', () => {
  it('flags a description that contains a forbidden marketing word', () => {
    const catalog: Catalog = {
      tools: [
        {
          name: 'packrat_search_trails',
          description: 'Our revolutionary AI-powered search for trails.',
        },
      ],
    };
    const result = checkToolDescriptionsNonPromotional(catalog);
    expect(result.status).toBe('fail');
    expect(result.details).toMatch(/revolutionary|AI-powered/);
  });

  it('passes on factual descriptions that mention AI without making a value claim', () => {
    const catalog: Catalog = {
      tools: [
        {
          name: 'packrat_analyze_pack_image',
          description: 'Uses AI to identify gear in a packing photo.',
        },
        {
          name: 'packrat_get_pack',
          description: 'Fetch a single pack by id.',
        },
      ],
    };
    expect(checkToolDescriptionsNonPromotional(catalog).status).toBe('pass');
  });

  it('exports a non-empty forbidden-pattern list', () => {
    expect(FORBIDDEN_PROMO_PATTERNS.length).toBeGreaterThan(3);
  });
});

// ── summarize ─────────────────────────────────────────────────────────────

describe('summarize', () => {
  it('counts pass / fail / warn correctly', () => {
    const summary = summarize([
      { name: 'a', label: 'a', status: 'pass', details: '' },
      { name: 'b', label: 'b', status: 'pass', details: '' },
      { name: 'c', label: 'c', status: 'fail', details: '' },
      { name: 'd', label: 'd', status: 'warn', details: '' },
    ]);
    expect(summary).toEqual({ passed: 2, failed: 1, warned: 1, total: 4 });
  });
});
