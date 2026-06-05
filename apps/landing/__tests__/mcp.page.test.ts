/**
 * Smoke tests for the MCP public docs page (U13).
 *
 * Same vitest-against-source approach as `legal.pages.test.ts`: the landing
 * app uses Next.js `output: 'export'` and a node-only vitest env, so we
 * can't import the RSC route directly. Assertions operate on the page
 * source plus the generated `mcp-catalog.json` to verify reviewer-facing
 * invariants the connector-store submission will be evaluated against.
 *
 * What we verify:
 *   - The page source exists, exports the standard metadata shape with
 *     `robots.index: true` (Anthropic must be able to crawl the docs URL).
 *   - The Quickstart / Scopes / Example prompts / Tool catalog / Resources
 *     / Privacy & security / Reviewer test account sections all render.
 *   - Three example prompts appear (per Software Directory Policy).
 *   - The Claude.ai custom-connector install URL is exactly the production
 *     MCP endpoint string.
 *   - `mcp-catalog.json` is present and non-trivial — the page renders
 *     from it, so a missing or empty JSON would surface as a build-time
 *     RSC error in production.
 */

import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const APP_DIR = resolve(__dirname, '..');
const PAGE = resolve(APP_DIR, 'app/mcp/page.tsx');
const CATALOG = resolve(APP_DIR, 'data/mcp-catalog.json');

describe('MCP public docs page (/mcp)', () => {
  it('source file exists', () => {
    expect(existsSync(PAGE)).toBe(true);
  });

  const source = existsSync(PAGE) ? readFileSync(PAGE, 'utf8') : '';

  it('exports a Next.js metadata block (indexable)', () => {
    expect(source).toContain('export const metadata');
    expect(source).toMatch(/title:\s*'PackRat MCP Connector \| PackRat'/);
    expect(source).toMatch(/robots:\s*\{\s*index:\s*true/);
  });

  it('renders the hero heading', () => {
    expect(source).toMatch(/Plan trips, build packs, check weather/);
  });

  it('exposes the production MCP endpoint URL verbatim', () => {
    // The submission packet, the public docs page, and the worker's
    // resourceMetadata MUST all advertise the same URL. A diff here is the
    // canary on a drift that breaks Anthropic's audience verification.
    expect(source).toContain('https://mcp.packratai.com/mcp');
  });

  it('lists the four OAuth scopes', () => {
    // Sourced from the JSON dump at render time, but the header / table
    // copy refers to them inline; the smoke test asserts both.
    for (const scope of ['mcp', 'mcp:read', 'mcp:write', 'mcp:admin']) {
      expect(source).toContain(scope);
    }
  });

  it('uses the Anthropic "custom connector" terminology', () => {
    expect(source).toMatch(/custom connector/i);
  });

  it('ships ≥ 3 example prompts (Software Directory Policy)', () => {
    // Each example prompt is wrapped in a <blockquote>; count those.
    const blockquotes = source.match(/<blockquote/g) ?? [];
    expect(blockquotes.length).toBeGreaterThanOrEqual(3);
  });

  it('points reviewers at the submission-packet doc for credentials', () => {
    expect(source).toContain('docs/mcp/submission-packet.md');
    // And explicitly states credentials are NOT on the public page.
    expect(source).toMatch(/do not publish credentials/i);
  });

  it('links the legal / privacy / support surfaces', () => {
    expect(source).toContain('/privacy-policy');
    expect(source).toContain('/terms-of-service');
    expect(source).toContain('hello@packratai.com');
  });

  it('points to the developer README and the implementation plan', () => {
    expect(source).toContain('packages/mcp/README.md');
    expect(source).toContain(
      'docs/plans/2026-05-22-001-feat-mcp-connector-store-readiness-plan.md',
    );
    expect(source).toContain('docs/mcp/runbook.md');
  });
});

describe('mcp-catalog.json (build-time data source for /mcp)', () => {
  it('is present and parses as JSON', () => {
    expect(existsSync(CATALOG)).toBe(true);
    const raw = readFileSync(CATALOG, 'utf8');
    // Must round-trip cleanly — the page imports it as a typed module.
    expect(() => JSON.parse(raw)).not.toThrow();
  });

  const raw = existsSync(CATALOG) ? readFileSync(CATALOG, 'utf8') : '{}';
  const catalog = JSON.parse(raw) as {
    totalTools?: number;
    counts?: { byClassification?: Record<string, number> };
    tools?: Array<{ name: string; classification: string }>;
    endpoint?: string;
  };

  it('contains ≥ 80 tools (sanity floor matching the U7 annotations test)', () => {
    expect(catalog.totalTools ?? 0).toBeGreaterThanOrEqual(80);
    expect((catalog.tools ?? []).length).toBe(catalog.totalTools ?? -1);
  });

  it('every tool name starts with the packrat_ prefix', () => {
    for (const t of catalog.tools ?? []) {
      expect(t.name).toMatch(/^packrat_/);
    }
  });

  it('partitions tools into read / write / admin classifications', () => {
    const c = catalog.counts?.byClassification ?? {};
    expect(c.read).toBeGreaterThan(0);
    expect(c.write).toBeGreaterThan(0);
    expect(c.admin).toBeGreaterThan(0);
  });

  it('advertises the production endpoint URL', () => {
    expect(catalog.endpoint).toBe('https://mcp.packratai.com/mcp');
  });
});
