/**
 * Pre-build script: generates the static Open Graph image PNG for the Trails app.
 *
 * Static exports (`output: 'export'`) cannot serve Next.js metadata-route images
 * (opengraph-image.tsx) correctly from a CDN — the generated .body/.meta files
 * are a Next.js-internal format, not plain PNG files.
 *
 * This script renders the same JSX used in opengraph-image.tsx via ImageResponse
 * and writes a real .png file to public/ so the CDN can serve it with the correct
 * Content-Type automatically.
 *
 * Run: `bun run scripts/generate-og-images.ts`
 * Output: apps/trails/public/og-image.png
 */

import fs from 'node:fs';
import path from 'node:path';
import { ImageResponse } from 'next/og';
import { createElement } from 'react';
import { getTrailsOgImageElement, OG_IMAGE_SIZE } from '../lib/og-image';

// Intercept Google Fonts requests — CF Pages' build network occasionally 4xx's
// fonts.googleapis.com, which kills the build. Return 404 to fall back to
// bundled fonts instead.
const FONT_HOSTS = new Set(['fonts.googleapis.com', 'fonts.gstatic.com']);
const originalFetch = globalThis.fetch;
globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
  const href =
    typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
  try {
    if (FONT_HOSTS.has(new URL(href).hostname)) {
      return new Response(null, { status: 404 });
    }
  } catch {
    // Not a parseable absolute URL — fall through to the real fetch.
  }
  return originalFetch(input, init);
}) as typeof fetch;

const PUBLIC_DIR = path.join(import.meta.dir, '..', 'public');

async function generateOgImages(): Promise<void> {
  if (!fs.existsSync(PUBLIC_DIR)) {
    fs.mkdirSync(PUBLIC_DIR, { recursive: true });
  }

  const response = new ImageResponse(
    createElement(() => getTrailsOgImageElement()),
    OG_IMAGE_SIZE,
  );

  const buffer = Buffer.from(await response.arrayBuffer());
  const outputPath = path.join(PUBLIC_DIR, 'og-image.png');
  fs.writeFileSync(outputPath, buffer);

  const rel = path.relative(process.cwd(), outputPath);
  console.log(`✓ Generated ${rel} (${buffer.length} bytes)`);
}

generateOgImages().catch((err) => {
  console.error('Failed to generate OG images:', err);
  process.exit(1);
});
