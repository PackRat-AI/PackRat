import { execSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import * as cheerio from 'cheerio';
import { beforeAll, describe, expect, it } from 'vitest';

const APP_DIR = path.resolve(__dirname, '..');
const OUT_DIR = path.join(APP_DIR, 'out');
const ROOT_INDEX = path.join(OUT_DIR, 'index.html');

/**
 * Required OG / Twitter meta tag names for every landing page. Same set the
 * guides test enforces; consistent shape across web apps is the whole point
 * of this validation layer.
 */
const REQUIRED_OG_META = [
  'og:title',
  'og:description',
  'og:image',
  'og:image:width',
  'og:image:height',
  'og:type',
  'og:url',
  'og:site_name',
  'twitter:card',
  'twitter:title',
  'twitter:description',
  'twitter:image',
] as const;

type MetaMap = Map<string, string>;

function parseMeta(html: string): MetaMap {
  const $ = cheerio.load(html);
  const meta: MetaMap = new Map();
  $('meta').each((_, el) => {
    const property = $(el).attr('property') ?? $(el).attr('name');
    const content = $(el).attr('content');
    if (property && content && !meta.has(property)) {
      meta.set(property, content);
    }
  });
  return meta;
}

/**
 * Walk the static export for top-level pages. Next.js with `output: 'export'`
 * and no `trailingSlash` config emits each route as either
 * `out/<slug>/index.html` (nested routes) or `out/<slug>.html`. We want both.
 * Skip 404/error pages — they're conventional Next.js artifacts whose OG
 * payload reasonably differs.
 */
function listLandingHtmlFiles(): string[] {
  if (!fs.existsSync(OUT_DIR)) return [];
  const results: string[] = [];
  const seen = new Set<string>();
  const skipNames = new Set(['404.html', '500.html', 'not-found.html']);

  // Top-level *.html
  for (const entry of fs.readdirSync(OUT_DIR, { withFileTypes: true })) {
    if (!entry.isFile()) continue;
    if (!entry.name.endsWith('.html')) continue;
    if (skipNames.has(entry.name)) continue;
    const full = path.join(OUT_DIR, entry.name);
    if (!seen.has(full)) {
      seen.add(full);
      results.push(full);
    }
  }

  // Nested <slug>/index.html (one level deep — landing has flat routes).
  for (const entry of fs.readdirSync(OUT_DIR, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    if (entry.name.startsWith('_')) continue;
    const nested = path.join(OUT_DIR, entry.name, 'index.html');
    if (fs.existsSync(nested) && !seen.has(nested)) {
      seen.add(nested);
      results.push(nested);
    }
  }

  return results;
}

function isAbsoluteHttps(url: string | undefined): boolean {
  return typeof url === 'string' && url.startsWith('https://');
}

/**
 * Landing's site-wide image must be the static `/og-image.png` written by
 * `scripts/generate-og-images.ts`. With `output: 'export'`, the Next.js
 * `/opengraph-image` metadata route does NOT produce a plain PNG file that a
 * CDN can serve — only `og-image.png` (pre-generated at build time) is valid.
 */
function isLandingOgImageUrl(url: string | undefined): boolean {
  if (!url) return false;
  return /\/og-image\.png(\?|$)/.test(url);
}

describe('landing built HTML OG meta', () => {
  beforeAll(() => {
    if (!fs.existsSync(ROOT_INDEX)) {
      execSync('bun run build', {
        cwd: APP_DIR,
        stdio: 'inherit',
      });
    }
  }, 240_000);

  const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

  it('root out/index.html exists', () => {
    expect(fs.existsSync(ROOT_INDEX), 'expected out/index.html to exist after build').toBe(true);
  });

  it('out/og-image.png is present in the static export', () => {
    const ogPath = path.join(OUT_DIR, 'og-image.png');
    expect(
      fs.existsSync(ogPath),
      'og-image.png must be copied from public/ into the out/ static export by next build. ' +
        'If missing, run scripts/generate-og-images.ts before building.',
    ).toBe(true);
  });

  it('out/og-image.png is a valid 1200×630 PNG', () => {
    const buf = fs.readFileSync(path.join(OUT_DIR, 'og-image.png'));
    expect(buf.subarray(0, 8), 'PNG signature').toEqual(PNG_SIGNATURE);
    expect(buf.readUInt32BE(16), 'width').toBe(1200);
    expect(buf.readUInt32BE(20), 'height').toBe(630);
    expect(buf.length, 'file size').toBeGreaterThan(1024);
  });

  it('discovers at least one landing HTML page beyond root', () => {
    const files = listLandingHtmlFiles();
    // Expect index.html plus at least one of about / pricing / blog /
    // privacy-policy / account-deletion. If this trips, either the build
    // failed to emit nested routes or someone removed every secondary
    // page — both are signal worth surfacing.
    expect(files.length, `expected >=2 HTML files in out/, got ${files.length}`).toBeGreaterThan(1);
  });

  it('root out/index.html has full OG meta with absolute site-wide og:image', () => {
    const html = fs.readFileSync(ROOT_INDEX, 'utf8');
    const meta = parseMeta(html);

    for (const tag of REQUIRED_OG_META) {
      expect(meta.get(tag), `root: missing <meta property|name="${tag}">`).toBeTruthy();
    }

    const ogImage = meta.get('og:image');
    expect(
      isAbsoluteHttps(ogImage),
      `root og:image must be absolute https URL, got: ${ogImage}`,
    ).toBe(true);
    expect(
      isLandingOgImageUrl(ogImage),
      `root og:image must reference og-image or opengraph-image, got: ${ogImage}`,
    ).toBe(true);

    const twitterImage = meta.get('twitter:image');
    expect(
      isAbsoluteHttps(twitterImage),
      `root twitter:image must be absolute, got: ${twitterImage}`,
    ).toBe(true);

    expect(meta.get('twitter:card')).toBe('summary_large_image');
    expect(meta.get('og:type')).toBe('website');
    expect(meta.get('og:site_name')).toBe('PackRat');
  });

  it('every landing HTML page has full OG meta + absolute og:image', () => {
    const files = listLandingHtmlFiles();
    const failures: string[] = [];

    for (const file of files) {
      const rel = path.relative(OUT_DIR, file);
      const meta = parseMeta(fs.readFileSync(file, 'utf8'));

      for (const tag of REQUIRED_OG_META) {
        if (!meta.get(tag)) {
          failures.push(`${rel}: missing <meta property|name="${tag}">`);
        }
      }

      const ogImage = meta.get('og:image');
      if (!isAbsoluteHttps(ogImage)) {
        failures.push(`${rel}: og:image not absolute (${ogImage})`);
      } else if (!isLandingOgImageUrl(ogImage)) {
        failures.push(`${rel}: og:image not a site-wide image route (${ogImage})`);
      }

      const twitterImage = meta.get('twitter:image');
      if (!isAbsoluteHttps(twitterImage)) {
        failures.push(`${rel}: twitter:image not absolute (${twitterImage})`);
      }

      const card = meta.get('twitter:card');
      if (card !== 'summary_large_image') {
        failures.push(`${rel}: twitter:card="${card}" (expected summary_large_image)`);
      }

      const siteName = meta.get('og:site_name');
      if (siteName !== 'PackRat') {
        failures.push(`${rel}: og:site_name="${siteName}" (expected PackRat)`);
      }
    }

    expect(failures, `OG meta issues:\n${failures.join('\n')}`).toEqual([]);
  });
});

/**
 * Optional live OG check. Set OG_LIVE_CHECK_URL to the deployed origin
 * (e.g. `https://packratai.com`) to fetch the homepage + a secondary page
 * over the wire and run them through `open-graph-scraper` — the same
 * parser most platforms (LinkedIn, FB, microlink) use.
 *
 * Skipped by default because it requires network + a live deploy.
 */
describe.skipIf(!process.env.OG_LIVE_CHECK_URL)('live OG check', () => {
  const liveUrl = (process.env.OG_LIVE_CHECK_URL ?? '').replace(/\/$/, '');

  it('root URL has valid OG metadata via open-graph-scraper', async () => {
    const mod = await import('open-graph-scraper');
    const ogs =
      typeof (mod as { default?: unknown }).default === 'function'
        ? (mod as { default: typeof mod.default }).default
        : (mod as unknown as typeof mod.default);
    const { result, error } = await ogs({ url: liveUrl, timeout: 15_000 });
    expect(error, `og fetch failed for ${liveUrl}`).toBeFalsy();
    expect(result.ogTitle, 'ogTitle').toBeTruthy();
    expect(result.ogDescription, 'ogDescription').toBeTruthy();
    expect(result.twitterCard).toBe('summary_large_image');
    const firstImage = result.ogImage?.[0]?.url;
    expect(isAbsoluteHttps(firstImage), `root ogImage[0].url absolute (got ${firstImage})`).toBe(
      true,
    );
  }, 30_000);

  it('/pricing has valid OG metadata via open-graph-scraper', async () => {
    const target = `${liveUrl}/pricing`;
    const mod = await import('open-graph-scraper');
    const ogs =
      typeof (mod as { default?: unknown }).default === 'function'
        ? (mod as { default: typeof mod.default }).default
        : (mod as unknown as typeof mod.default);
    const { result, error } = await ogs({ url: target, timeout: 15_000 });
    expect(error, `og fetch failed for ${target}`).toBeFalsy();
    expect(result.ogTitle, 'ogTitle').toBeTruthy();
    expect(result.twitterCard).toBe('summary_large_image');
    const firstImage = result.ogImage?.[0]?.url;
    expect(isAbsoluteHttps(firstImage), `pricing ogImage[0].url absolute (got ${firstImage})`).toBe(
      true,
    );
  }, 30_000);
});
