import { execSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import * as cheerio from 'cheerio';
import { beforeAll, describe, expect, it } from 'vitest';

const APP_DIR = path.resolve(__dirname, '..');
const OUT_DIR = path.join(APP_DIR, 'out');
const ROOT_INDEX = path.join(OUT_DIR, 'index.html');

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

function isAbsoluteHttps(url: string | undefined): boolean {
  return typeof url === 'string' && url.startsWith('https://');
}

describe('trails built HTML OG meta', () => {
  const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

  beforeAll(() => {
    if (!fs.existsSync(ROOT_INDEX)) {
      execSync('bun run build', { cwd: APP_DIR, stdio: 'inherit' });
    }
  }, 240_000);

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

  it('root out/index.html has full OG meta with absolute og:image', () => {
    const html = fs.readFileSync(ROOT_INDEX, 'utf8');
    const meta = parseMeta(html);

    for (const tag of REQUIRED_OG_META) {
      expect(meta.get(tag), `root: missing <meta property|name="${tag}">`).toBeTruthy();
    }

    const ogImage = meta.get('og:image');
    expect(isAbsoluteHttps(ogImage), `og:image must be absolute https, got: ${ogImage}`).toBe(true);
    expect(ogImage, 'og:image must be /og-image.png').toMatch(/\/og-image\.png(\?|$)/);

    const twitterImage = meta.get('twitter:image');
    expect(
      isAbsoluteHttps(twitterImage),
      `twitter:image must be absolute, got: ${twitterImage}`,
    ).toBe(true);
    expect(twitterImage, 'twitter:image must be /og-image.png').toMatch(/\/og-image\.png(\?|$)/);

    expect(meta.get('twitter:card')).toBe('summary_large_image');
    expect(meta.get('og:type')).toBe('website');
    expect(meta.get('og:site_name')).toBe('PackRat');
  });
});

/**
 * Optional live OG check. Set OG_LIVE_CHECK_URL=https://trails.packratai.com
 * to verify the deployed site serves correct OG metadata.
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
    expect(result.twitterCard).toBe('summary_large_image');
    const firstImage = result.ogImage?.[0]?.url;
    expect(isAbsoluteHttps(firstImage), `ogImage[0].url absolute (got ${firstImage})`).toBe(true);
    expect(firstImage, 'ogImage must be og-image.png').toMatch(/\/og-image\.png(\?|$)/);
  }, 30_000);
});
