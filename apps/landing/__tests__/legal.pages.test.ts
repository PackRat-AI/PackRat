/**
 * Smoke tests for the legal pages (U12 of the MCP connector-store readiness
 * plan).
 *
 * The landing app uses Next.js with `output: 'export'` and a node-environment
 * vitest setup (see `vitest.config.ts`). React-server-component imports don't
 * resolve cleanly in that env, so the route-level "GET returns 200 with this
 * string" test the og-meta suite performs (against the built `out/` HTML)
 * would be the only true smoke pattern. We don't run a full Next build inside
 * this suite to keep it fast; instead, the assertions below operate on the
 * source `.tsx` files for the two legal pages and on the shared
 * `config/site.ts` block that wires them up.
 *
 * What we verify:
 *   - The Terms of Service page source exists, exports the standard metadata
 *     shape, and contains the load-bearing MCP, jurisdiction-TODO, and
 *     hello@packratai.com strings a reviewer will scan for.
 *   - The Privacy Policy page source contains the new MCP / connectors
 *     addendum (heading + key bullet content).
 *   - `siteConfig.footerLinks.legal` exposes BOTH Privacy and Terms, and
 *     `siteConfig.support` advertises the canonical mailto.
 *
 * If a route smoke pattern lands later (e.g. happy-dom env + RSC eval, or
 * a separate `vitest --config out-export.config.ts` workspace), the
 * file-text assertions can be replaced — the reviewer-facing intent is the
 * stable contract.
 */
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { siteConfig } from '../config/site';

const APP_DIR = resolve(__dirname, '..');
const TOS_PAGE = resolve(APP_DIR, 'app/terms-of-service/page.tsx');
const PRIVACY_PAGE = resolve(APP_DIR, 'app/privacy-policy/page.tsx');

describe('Terms of Service page (/terms-of-service)', () => {
  it('source file exists', () => {
    expect(existsSync(TOS_PAGE)).toBe(true);
  });

  const source = existsSync(TOS_PAGE) ? readFileSync(TOS_PAGE, 'utf8') : '';

  it('exports a Next.js metadata block with title/description/robots', () => {
    expect(source).toContain('export const metadata');
    expect(source).toContain("title: 'Terms of Service | PackRat'");
    expect(source).toMatch(/description:\s*'[^']+'/);
    expect(source).toMatch(/robots:\s*\{[^}]*index:\s*true/);
  });

  it('renders the "Terms of Service" heading', () => {
    expect(source).toContain('>Terms of Service<');
  });

  it('covers MCP connector provisions', () => {
    // Reviewers grep for "MCP" — this section is the new content this unit
    // ships and is what Anthropic's policy expects to find.
    expect(source).toMatch(/MCP/);
    expect(source).toContain('mcp.packratai.com');
    expect(source).toMatch(/mcp:admin/);
    expect(source).toMatch(/OAuth/);
  });

  it('includes the outdoor-safety disclaimer', () => {
    expect(source).toMatch(/inherent risks/i);
  });

  it('surfaces the canonical support contact', () => {
    expect(source).toContain('hello@packratai.com');
  });

  it('leaves the operator-jurisdiction TODO marker in place', () => {
    // U12 deliberately ships with a placeholder jurisdiction (Delaware) and a
    // TODO so the operator can replace it after legal review. The check
    // prevents the TODO from being silently lost in a future edit.
    expect(source).toMatch(/TODO\(operator\): set jurisdiction/);
  });
});

describe('Privacy Policy page (/privacy-policy) — MCP addendum', () => {
  it('source file exists', () => {
    expect(existsSync(PRIVACY_PAGE)).toBe(true);
  });

  const source = existsSync(PRIVACY_PAGE) ? readFileSync(PRIVACY_PAGE, 'utf8') : '';

  it('renders the new "MCP Connector & Third-Party Clients" section heading', () => {
    expect(source).toContain('MCP Connector & Third-Party Clients');
  });

  it('explains OAuth token storage and rotation', () => {
    expect(source).toMatch(/refresh token/i);
    expect(source).toMatch(/Cloudflare KV/);
    expect(source).toMatch(/60 minutes/);
  });

  it('clarifies what MCP clients do NOT see', () => {
    expect(source).toMatch(/never sees your\s+PackRat password|never sees your password/i);
    expect(source).toMatch(/conversation content/i);
  });

  it('points users at hello@packratai.com for deletion', () => {
    expect(source).toContain('hello@packratai.com');
  });
});

describe('siteConfig wiring (U12)', () => {
  it('exposes BOTH Privacy and Terms in the footer legal block', () => {
    const titles = siteConfig.footerLinks.legal.map((l) => l.title);
    expect(titles).toContain('Privacy');
    expect(titles).toContain('Terms');

    const hrefs = siteConfig.footerLinks.legal.map((l) => l.href);
    expect(hrefs).toContain('/privacy-policy');
    expect(hrefs).toContain('/terms-of-service');
  });

  it('exposes the canonical support contact', () => {
    expect(siteConfig.support).toBeDefined();
    expect(siteConfig.support.email).toBe('hello@packratai.com');
    expect(siteConfig.support.mailto).toBe('mailto:hello@packratai.com');
  });
});
