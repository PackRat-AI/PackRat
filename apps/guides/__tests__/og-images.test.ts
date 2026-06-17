/**
 * End-to-end test for the OG image pipeline.
 *
 * This is the regression test for PR #2436: the bug was that
 * `generate-og-images` ran BEFORE `build-content`, so OG images were generated
 * for the 39 posts that happened to be committed in `lib/content.ts` instead
 * of the 504 MDX files actually on disk.
 *
 * What this test does:
 *   1. Asserts that the count of files in `public/og/*.png` matches the
 *      number of posts in `lib/content.ts`, and that the root
 *      `public/og-image.png` exists.
 *   2. Spot-checks PNG validity (magic bytes + non-zero size).
 *
 * The actual `build-content` + `generate-og-images` pipeline is run by the
 * `test:og` package script BEFORE invoking vitest. Doing the heavy work
 * outside the test runner keeps vitest's RPC reporter from timing out on the
 * ~500 lines of progress output and producing a spurious worker error.
 */

import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

// This suite is gated behind `RUN_OG_PIPELINE_TEST=1` (set by the `test:og`
// script) so it does not bog down the regular `bun run test` flow.
const RUN = process.env.RUN_OG_PIPELINE_TEST === '1';
const describeOrSkip = RUN ? describe : describe.skip;

const APP_DIR = path.resolve(__dirname, '..');
const PUBLIC_DIR = path.join(APP_DIR, 'public');
const OG_DIR = path.join(PUBLIC_DIR, 'og');
const ROOT_OG_PATH = path.join(PUBLIC_DIR, 'og-image.png');
const POSTS_DIR = path.join(APP_DIR, 'content', 'posts');

const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

function countMdxPosts(): number {
  return fs.readdirSync(POSTS_DIR).filter((f) => f.endsWith('.mdx')).length;
}

function loadPostCountFromContentTs(): number {
  // Read the auto-generated content.ts and count slug entries. We avoid
  // importing the module here because that would pull in Next.js types via
  // the alias chain; counting slug declarations is sufficient. The regex
  // tolerates either `slug:` or `"slug":` since build-content has emitted
  // both formats over time.
  const contentPath = path.join(APP_DIR, 'lib', 'content.ts');
  const src = fs.readFileSync(contentPath, 'utf8');
  return (src.match(/^\s+"?slug"?\s*:/gm) ?? []).length;
}

function assertPng(filePath: string): void {
  const buf = fs.readFileSync(filePath);
  expect(buf.length, `${path.basename(filePath)} non-empty`).toBeGreaterThan(0);
  expect(buf.subarray(0, 8), `${path.basename(filePath)} PNG signature`).toEqual(PNG_SIGNATURE);
}

describeOrSkip('OG image pipeline (build-content → generate-og-images)', () => {
  it('lib/content.ts post count matches MDX file count', () => {
    const mdxCount = countMdxPosts();
    const contentCount = loadPostCountFromContentTs();
    expect(mdxCount, 'no MDX posts found on disk').toBeGreaterThan(0);
    expect(contentCount, 'lib/content.ts is stale vs content/posts/').toBe(mdxCount);
  });

  it('generates the root site OG image', () => {
    expect(fs.existsSync(ROOT_OG_PATH), `${ROOT_OG_PATH} does not exist`).toBe(true);
    assertPng(ROOT_OG_PATH);
  });

  it('generates exactly one PNG per post', () => {
    const expectedCount = loadPostCountFromContentTs();
    expect(fs.existsSync(OG_DIR), `${OG_DIR} does not exist`).toBe(true);

    const generatedPngs = fs.readdirSync(OG_DIR).filter((f) => f.endsWith('.png'));
    expect(
      generatedPngs.length,
      `Expected ${expectedCount} per-post OG images (one per post in lib/content.ts), ` +
        `got ${generatedPngs.length}. This usually means generate-og-images ran ` +
        `before build-content — see PR #2436.`,
    ).toBe(expectedCount);
  });

  it('every per-post PNG is non-empty and starts with the PNG magic bytes', () => {
    const generatedPngs = fs.readdirSync(OG_DIR).filter((f) => f.endsWith('.png'));
    for (const name of generatedPngs) {
      assertPng(path.join(OG_DIR, name));
    }
  });
});
