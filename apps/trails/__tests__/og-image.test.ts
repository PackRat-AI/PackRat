import { execSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { beforeAll, describe, expect, it } from 'vitest';
import { OG_IMAGE_URL, trailsMetadata } from '../lib/metadata';

const APP_DIR = path.resolve(__dirname, '..');
const OG_IMAGE_PATH = path.resolve(APP_DIR, 'public/og-image.png');
const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

function readUint32BE(buf: Buffer, offset: number): number {
  return buf.readUInt32BE(offset);
}

describe('trails OG image generation', () => {
  beforeAll(() => {
    execSync('bun run scripts/generate-og-images.ts', {
      cwd: APP_DIR,
      stdio: 'inherit',
    });
  });

  it('generates public/og-image.png', () => {
    expect(fs.existsSync(OG_IMAGE_PATH)).toBe(true);
  });

  it('output is a valid PNG file', () => {
    const buf = fs.readFileSync(OG_IMAGE_PATH);
    expect(buf.subarray(0, 8)).toEqual(PNG_SIGNATURE);
  });

  it('PNG has correct dimensions (1200 × 630)', () => {
    const buf = fs.readFileSync(OG_IMAGE_PATH);
    expect(readUint32BE(buf, 16)).toBe(1200);
    expect(readUint32BE(buf, 20)).toBe(630);
  });

  it('PNG is non-trivially sized (> 1 KB)', () => {
    const { size } = fs.statSync(OG_IMAGE_PATH);
    expect(size).toBeGreaterThan(1024);
  });

  it('metadata og:image URL references the generated file', () => {
    const images = (trailsMetadata.openGraph as { images?: unknown })?.images;
    const first = Array.isArray(images) ? images[0] : images;
    const url = typeof first === 'string' ? first : (first as { url: string })?.url;
    const pathname = new URL(url).pathname;
    const filePath = path.resolve(APP_DIR, 'public', pathname.slice(1));
    expect(
      fs.existsSync(filePath),
      `og:image URL (${url}) → ${filePath} does not exist in public/`,
    ).toBe(true);
  });
});

describe('trails layout metadata', () => {
  it('openGraph.images[0].url is the absolute og-image.png URL', () => {
    const images = (trailsMetadata.openGraph as { images?: unknown })?.images;
    expect(images).toBeDefined();
    const first = Array.isArray(images) ? images[0] : images;
    const url = typeof first === 'string' ? first : (first as { url: string })?.url;
    expect(url).toBe(OG_IMAGE_URL);
  });

  it('twitter.images[0] is the absolute og-image.png URL', () => {
    const images = (trailsMetadata.twitter as { images?: unknown })?.images;
    expect(images).toBeDefined();
    const first = Array.isArray(images) ? images[0] : images;
    const twitterUrl =
      typeof first === 'string' ? first : ((first as { url?: string })?.url ?? first);
    expect(twitterUrl).toBe(OG_IMAGE_URL);
  });

  it('twitter.card is summary_large_image', () => {
    expect((trailsMetadata.twitter as { card?: string })?.card).toBe('summary_large_image');
  });
});
