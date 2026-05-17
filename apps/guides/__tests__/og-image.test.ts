import { execSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { beforeAll, describe, expect, it } from 'vitest';
import { getAllPosts } from '../lib/mdx-static';
import { guidesMetadata } from '../lib/metadata';

const APP_DIR = path.resolve(__dirname, '..');
const PUBLIC_DIR = path.join(APP_DIR, 'public');
const OG_DIR = path.join(PUBLIC_DIR, 'og');
const ROOT_OG_PATH = path.join(PUBLIC_DIR, 'og-image.png');

const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

/** Read a uint32 big-endian from a buffer at offset. */
function readUint32BE(buf: Buffer, offset: number): number {
  return buf.readUInt32BE(offset);
}

function assertValidPng(filePath: string): void {
  const buf = fs.readFileSync(filePath);
  expect(buf.subarray(0, 8), `${path.basename(filePath)} PNG signature`).toEqual(PNG_SIGNATURE);
  const width = readUint32BE(buf, 16);
  const height = readUint32BE(buf, 20);
  expect(width, `${path.basename(filePath)} width`).toBe(1200);
  expect(height, `${path.basename(filePath)} height`).toBe(630);
  expect(buf.length, `${path.basename(filePath)} size`).toBeGreaterThan(1024);
}

describe('guides OG image generation', () => {
  // Generating per-post PNGs takes ~30-60s for the full set;
  // default vitest hook timeout is 5s.
  beforeAll(() => {
    execSync('bun run scripts/generate-og-images.ts', {
      cwd: APP_DIR,
      stdio: 'inherit',
    });
  }, 180_000);

  it('generates public/og-image.png', () => {
    expect(fs.existsSync(ROOT_OG_PATH)).toBe(true);
  });

  it('root og-image.png is a valid 1200×630 PNG', () => {
    assertValidPng(ROOT_OG_PATH);
  });

  it('generates public/og/ directory', () => {
    expect(fs.existsSync(OG_DIR)).toBe(true);
  });

  it('generates a per-post PNG for every post', () => {
    const posts = getAllPosts();
    expect(posts.length).toBeGreaterThan(0);

    for (const post of posts) {
      const filePath = path.join(OG_DIR, `${post.slug}.png`);
      expect(fs.existsSync(filePath), `missing: og/${post.slug}.png`).toBe(true);
    }
  });

  it('every per-post PNG is a valid 1200×630 PNG', () => {
    const posts = getAllPosts();
    for (const post of posts) {
      assertValidPng(path.join(OG_DIR, `${post.slug}.png`));
    }
  });
});

describe('guides layout metadata', () => {
  it('includes openGraph.images pointing to /og-image.png', () => {
    const images = (guidesMetadata.openGraph as { images?: unknown })?.images;
    expect(images).toBeDefined();
    const first = Array.isArray(images) ? images[0] : images;
    const url = typeof first === 'string' ? first : (first as { url: string })?.url;
    expect(url).toBe('/og-image.png');
  });

  it('includes twitter.images pointing to /og-image.png', () => {
    const images = (guidesMetadata.twitter as { images?: unknown })?.images;
    expect(images).toBeDefined();
    const first = Array.isArray(images) ? images[0] : images;
    expect(first).toBe('/og-image.png');
  });
});

describe('guides per-slug page metadata', () => {
  it('generateMetadata sets openGraph.images to /og/[slug].png', async () => {
    // Dynamically import to avoid top-level JSX issues in test runner
    const { generateMetadata } = await import('../app/guide/[slug]/page');
    const posts = getAllPosts();
    const post = posts[0];
    if (!post) throw new Error('No posts found');

    const meta = await generateMetadata({ params: Promise.resolve({ slug: post.slug }) });
    const images = (meta.openGraph as { images?: unknown })?.images;
    expect(images).toBeDefined();
    const first = Array.isArray(images) ? images[0] : images;
    const url = typeof first === 'string' ? first : (first as { url: string })?.url;
    expect(url).toBe(`/og/${post.slug}.png`);
  });

  it('generateMetadata sets twitter.images to /og/[slug].png', async () => {
    const { generateMetadata } = await import('../app/guide/[slug]/page');
    const posts = getAllPosts();
    const post = posts[0];
    if (!post) throw new Error('No posts found');

    const meta = await generateMetadata({ params: Promise.resolve({ slug: post.slug }) });
    const images = (meta.twitter as { images?: unknown })?.images;
    expect(images).toBeDefined();
    const first = Array.isArray(images) ? images[0] : images;
    expect(first).toBe(`/og/${post.slug}.png`);
  });
});
