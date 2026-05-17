/**
 * Pre-build script: generates static Open Graph image PNGs for the landing site.
 *
 * Static exports (`output: 'export'`) cannot serve Next.js metadata-route images
 * (opengraph-image.tsx) correctly from a CDN — the generated .body/.meta files
 * are a Next.js-internal format, not plain PNG files.
 *
 * This script renders the same JSX used in opengraph-image.tsx via ImageResponse
 * and writes a real .png file to public/ so Cloudflare Workers can serve it with
 * the correct Content-Type automatically.
 *
 * Run: `bun run scripts/generate-og-images.ts`
 * Output: apps/landing/public/og-image.png
 */

import fs from 'node:fs';
import path from 'node:path';
import { ImageResponse } from 'next/og';
import { createElement } from 'react';
import { getLandingOgImageElement, OG_IMAGE_SIZE } from '../lib/og-image';

// @vercel/og auto-fetches Google Fonts when it encounters glyphs outside its
// bundled Latin coverage. CF Pages' build network occasionally returns 4xx for
// fonts.googleapis.com, killing the build. Intercept and return an empty 404
// so loadGoogleFont gives up cleanly and ImageResponse falls back to bundled.
const originalFetch = globalThis.fetch;
globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
  const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
  if (url.includes('fonts.googleapis.com') || url.includes('fonts.gstatic.com')) {
    return new Response(null, { status: 404 });
  }
  return originalFetch(input, init);
}) as typeof fetch;

const PUBLIC_DIR = path.join(import.meta.dir, '..', 'public');

async function generateOgImages(): Promise<void> {
  if (!fs.existsSync(PUBLIC_DIR)) {
    fs.mkdirSync(PUBLIC_DIR, { recursive: true });
  }

  const response = new ImageResponse(
    createElement(() => getLandingOgImageElement()),
    OG_IMAGE_SIZE,
  );

  const buffer = Buffer.from(await response.arrayBuffer());
  const outputPath = path.join(PUBLIC_DIR, 'og-image.png');
  fs.writeFileSync(outputPath, buffer);

  console.log(`✓ Generated ${path.relative(process.cwd(), outputPath)} (${buffer.length} bytes)`);
}

generateOgImages().catch((err) => {
  console.error('Failed to generate OG images:', err);
  process.exit(1);
});
