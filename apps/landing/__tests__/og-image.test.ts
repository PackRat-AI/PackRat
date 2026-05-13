import { execSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { beforeAll, describe, expect, it } from 'vitest';
import { landingMetadata } from '../lib/metadata';

const OG_IMAGE_PATH = path.resolve(__dirname, '../public/og-image.png');
const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

/** Read a uint32 big-endian from a buffer at offset. */
function readUint32BE(buf: Buffer, offset: number): number {
  return buf.readUInt32BE(offset);
}

describe('landing OG image generation', () => {
  beforeAll(() => {
    execSync('bun run scripts/generate-og-images.ts', {
      cwd: path.resolve(__dirname, '..'),
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
    // IHDR chunk starts at byte 16; first 4 bytes = width, next 4 = height
    const width = readUint32BE(buf, 16);
    const height = readUint32BE(buf, 20);
    expect(width).toBe(1200);
    expect(height).toBe(630);
  });

  it('PNG is non-trivially sized (> 1 KB)', () => {
    const { size } = fs.statSync(OG_IMAGE_PATH);
    expect(size).toBeGreaterThan(1024);
  });
});

describe('landing metadata', () => {
  it('includes openGraph.images pointing to /og-image.png', () => {
    const images = (landingMetadata.openGraph as { images?: unknown })?.images;
    expect(images).toBeDefined();
    const first = Array.isArray(images) ? images[0] : images;
    const url = typeof first === 'string' ? first : (first as { url: string })?.url;
    expect(url).toBe('/og-image.png');
  });

  it('includes twitter.images pointing to /og-image.png', () => {
    const images = (landingMetadata.twitter as { images?: unknown })?.images;
    expect(images).toBeDefined();
    const first = Array.isArray(images) ? images[0] : images;
    expect(first).toBe('/og-image.png');
  });
});
