/**
 * Pre-build script: generates static Open Graph image PNGs for the guides site.
 *
 * Static exports (`output: 'export'`) cannot serve Next.js metadata-route images
 * (opengraph-image.tsx) correctly from a CDN — the generated .body/.meta files
 * are a Next.js-internal format, not plain PNG files.
 *
 * This script renders the same JSX used in opengraph-image.tsx via ImageResponse
 * and writes real .png files to public/ so Cloudflare Workers can serve them with
 * the correct Content-Type automatically.
 *
 * Outputs:
 *   public/og-image.png          — root / site-level OG image
 *   public/og/[slug].png         — per-post OG images
 *
 * Run: `bun run scripts/generate-og-images.ts`
 */

import fs from 'node:fs';
import path from 'node:path';
import { ImageResponse } from 'next/og';
import { createElement } from 'react';
import { getAllPosts } from '../lib/mdx-static';
import { getGuidesOgImageElement, getPostOgImageElement, OG_IMAGE_SIZE } from '../lib/og-image';

const PUBLIC_DIR = path.join(import.meta.dir, '..', 'public');
const OG_DIR = path.join(PUBLIC_DIR, 'og');

async function renderToPng(element: ReturnType<typeof getGuidesOgImageElement>): Promise<Buffer> {
  const response = new ImageResponse(
    createElement(() => element),
    OG_IMAGE_SIZE,
  );
  return Buffer.from(await response.arrayBuffer());
}

async function generateOgImages(): Promise<void> {
  fs.mkdirSync(OG_DIR, { recursive: true });

  // Root site image
  const rootBuffer = await renderToPng(getGuidesOgImageElement());
  const rootPath = path.join(PUBLIC_DIR, 'og-image.png');
  fs.writeFileSync(rootPath, rootBuffer);
  console.log(`✓ Generated ${path.relative(process.cwd(), rootPath)} (${rootBuffer.length} bytes)`);

  // Per-post images
  const posts = getAllPosts();
  for (const post of posts) {
    const buffer = await renderToPng(
      getPostOgImageElement({
        title: post.title,
        description: post.description ?? '',
        categories: post.categories ?? [],
      }),
    );
    const outPath = path.join(OG_DIR, `${post.slug}.png`);
    fs.writeFileSync(outPath, buffer);
    console.log(`✓ Generated ${path.relative(process.cwd(), outPath)} (${buffer.length} bytes)`);
  }

  console.log(`\nDone — generated 1 root + ${posts.length} post OG images.`);
}

generateOgImages().catch((err) => {
  console.error('Failed to generate OG images:', err);
  process.exit(1);
});
