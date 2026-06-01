#!/usr/bin/env bun
import { spawnSync } from 'node:child_process';
import { mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { basename, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { chromium } from '@playwright/test';

const REPO_ROOT = resolve(import.meta.dir, '../../..');
const EXPO_DIR = resolve(REPO_ROOT, 'apps/expo');
const OUT_DIR = resolve(REPO_ROOT, 'artifacts/screenshots');
const WEB_DIR = resolve(OUT_DIR, 'web-playwright');
const CONTACT_SHEET_HTML = resolve(OUT_DIR, 'web-contact-sheet.html');
const CONTACT_SHEET_PNG = resolve(OUT_DIR, 'web-contact-sheet.png');

rmSync(WEB_DIR, { recursive: true, force: true });
mkdirSync(WEB_DIR, { recursive: true });

const result = spawnSync(
  'bunx',
  [
    'playwright',
    'test',
    '--config',
    'playwright/playwright.visual.config.ts',
    '--grep',
    'Web visual screenshot matrix',
  ],
  {
    cwd: EXPO_DIR,
    env: {
      ...process.env,
      PACKRAT_VISUAL_SCREENSHOTS: '1',
    },
    stdio: 'inherit',
  },
);

await renderContactSheet();

if (result.status !== 0) {
  process.exit(result.status ?? 1);
}

async function renderContactSheet() {
  const screenshots = readdirSync(WEB_DIR)
    .filter((file) => file.endsWith('.png'))
    .sort()
    .map((file) => resolve(WEB_DIR, file));
  if (screenshots.length === 0) return;

  const cards = screenshots
    .map((file) => {
      const src = pathToFileURL(file).href;
      const label = stripSortPrefix(basename(file, '.png'))
        .replaceAll('-', ' ')
        .split(' ')
        .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
        .join(' ');
      return `<figure><img src="${src}" /><figcaption>${escapeHtml(label)}</figcaption></figure>`;
    })
    .join('\n');

  const html = `<!doctype html>
<html>
<head>
<meta charset="utf-8" />
<style>
body { margin: 0; padding: 28px; background: #f5f5f7; color: #1d1d1f; font-family: -apple-system, BlinkMacSystemFont, "SF Pro Text", sans-serif; }
h1 { margin: 0 0 22px; font-size: 22px; }
.grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 18px; align-items: start; }
figure { margin: 0; padding: 10px; background: white; border: 1px solid #e5e5ea; border-radius: 10px; box-shadow: 0 1px 2px rgb(0 0 0 / 0.05); }
img { display: block; width: 100%; border: 1px solid #eee; border-radius: 6px; }
figcaption { padding-top: 8px; color: #6e6e73; font-size: 12px; }
</style>
</head>
<body>
<h1>PackRat Web Screens</h1>
<main class="grid">${cards}</main>
</body>
</html>`;

  writeFileSync(CONTACT_SHEET_HTML, html);
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({
    viewport: { width: 1800, height: estimateHeight(screenshots) },
  });
  await page.goto(pathToFileURL(CONTACT_SHEET_HTML).href);
  await page.screenshot({ path: CONTACT_SHEET_PNG, fullPage: true });
  await browser.close();

  const bytes = readFileSync(CONTACT_SHEET_PNG).byteLength;
  console.log(`✓ Wrote ${CONTACT_SHEET_PNG} (${Math.round(bytes / 1024)} KB)`);
}

function estimateHeight(screenshots: string[]): number {
  return Math.max(1200, Math.ceil(screenshots.length / 3) * 700 + 120);
}

function escapeHtml(value: string): string {
  return Array.from(value, (char) => {
    if (char === '&') return '&amp;';
    if (char === '<') return '&lt;';
    if (char === '>') return '&gt;';
    if (char === '"') return '&quot;';
    if (char === "'") return '&#39;';
    return char;
  }).join('');
}

function stripSortPrefix(value: string): string {
  let index = 0;
  while (index < value.length) {
    const code = value.charCodeAt(index);
    if (code < 48 || code > 57) break;
    index += 1;
  }
  return value.charAt(index) === '-' ? value.slice(index + 1) : value;
}
