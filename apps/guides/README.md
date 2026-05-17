# PackRat Guides

Next.js 15 static-export site that ships the hiking/outdoor guides corpus.
Deployed to Cloudflare Pages from `apps/guides/out/`.

## Build pipeline

The `build` script in `package.json` runs three steps **in this order**:

```
bun run build-content   →  bun run generate-og-images   →  next build
```

### Why order matters

- `scripts/build-content.ts` reads every `*.mdx` file in `content/posts/` and
  writes the array of posts to **`lib/content.ts`** (committed; checked in for
  fast cold builds).
- `scripts/generate-og-images.ts` **imports `lib/content.ts`** and renders one
  OG PNG per post into `public/og/<slug>.png`, plus a root `public/og-image.png`.
- `next build` produces the static export in `out/`.

If `generate-og-images` runs before `build-content`, it reads the previously
committed (stale) `lib/content.ts` and only generates OG images for that
older post set. That is exactly the bug PR #2436 fixed (39 OG images
generated for a corpus of 504 posts).

Guards against re-inverting the order:

1. The build script itself enforces order via `&&`.
2. `scripts/generate-og-images.ts` contains a runtime check
   (`assertContentIsFresh`) that throws a clear error if `lib/content.ts`
   looks suspiciously small compared to the number of MDX files on disk.
3. `__tests__/og-images.test.ts` exercises the full pipeline end-to-end and
   asserts that `public/og/*.png` count equals `lib/content.ts` post count.
   Run it with:

   ```
   bun run --cwd apps/guides test:og
   ```

4. The `Builds` GitHub Actions workflow
   (`.github/workflows/builds.yml`) builds the app on every PR and
   surfaces the post / OG image counts in the GitHub Step Summary so
   regressions are visible without depending on the Cloudflare Pages
   dashboard.

## Useful scripts

| Script | Purpose |
|---|---|
| `bun run dev` | Local Next.js dev server |
| `bun run build-content` | Regenerate `lib/content.ts` from MDX |
| `bun run generate-og-images` | Render OG PNGs into `public/og/` |
| `bun run build` | Full static build (`out/`) |
| `bun run test` | Lightweight vitest suite |
| `bun run test:og` | End-to-end OG image pipeline test (slow) |
| `bun run test:og-meta` | Parse built `out/**/index.html` and assert OG / Twitter meta tags |
| `bun run lighthouse` | Build + run LHCI assertions |
| `bun run sync-to-r2` | Sync content to `packrat-guides` R2 bucket |

## Open Graph metadata validation

All PackRat web apps (`apps/guides`, `apps/landing`) share the same OG
validation pattern, with per-app shapes:

- **Guides** has per-post images (`/og/<slug>.png`) and `og:type=article`.
- **Landing** has a single site-wide image (`/og-image.png`) and
  `og:type=website`.

See [`apps/landing/README.md`](../landing/README.md) for the landing variant.

We do three layers of OG validation:

1. **Image generation** — `test:og` verifies one PNG per post in `public/og/`.
   This catches the build-order bug (#2436) where OG images get generated
   from a stale `lib/content.ts`.
2. **Static meta in built HTML** — `test:og-meta` runs `bun run build`
   (if `out/` is missing) and then parses every `out/guide/<slug>.html`
   plus the root `out/index.html` with cheerio. It asserts the required
   tags (`og:title`, `og:description`, `og:image`, `og:image:width`,
   `og:image:height`, `og:type`, `og:url`, `og:site_name`, `twitter:card`,
   `twitter:title`, `twitter:description`, `twitter:image`) are present
   on a 3-post random sample and that **every** post has an absolute
   `https://` `og:image` URL pointing at `/og/<slug>.png`. The root page
   gets the same shape with the site-wide image (`/og-image.png` or the
   Next.js auto-generated `/opengraph-image` route — whichever wins).
   This step runs in the `Builds` workflow on every PR.
3. **Live OG meta on a deployed URL** — opt-in via
   `OG_LIVE_CHECK_URL=https://guides.packratai.com bun run test:og-meta`.
   Hits the live origin via [`open-graph-scraper`][ogs] (the same parser
   most platforms use under the hood) and asserts the same shape. Useful
   after a deploy when you want to confirm CF transforms / caches didn't
   eat any meta tags. Skipped by default.

### Manual validators

For one-off checks after a deploy, paste the URL into one of these:

- [opengraph.xyz](https://www.opengraph.xyz/) — quick visual preview
- [microlink.io](https://microlink.io/) — JSON view of every OG / Twitter tag
- [Facebook Sharing Debugger](https://developers.facebook.com/tools/debug/) — also flushes FB's cache for the URL
- [LinkedIn Post Inspector](https://www.linkedin.com/post-inspector/) — also flushes LI's cache

## Lighthouse CI

`.lighthouserc.js` (desktop) and `.lighthouserc.mobile.js` (mobile) drive
LHCI against the static `out/` directory. Budgets:

- Performance ≥ 0.8
- Accessibility / Best Practices / SEO ≥ 0.9
- LCP < 2500 ms (desktop) / 4000 ms (mobile)
- CLS < 0.1
- TBT < 300 ms (desktop) / 600 ms (mobile)

The `Builds` GitHub Actions workflow runs `lighthouse:ci` after the OG
meta test on every PR and surfaces the scores in the GitHub Step Summary.
The step is marked `continue-on-error: true` so perf regressions appear
as a yellow check on the PR rather than a hard block — keeps the cadence
fast while still surfacing the numbers to reviewers.

```
bun run --cwd apps/guides lighthouse        # full: build + LHCI
bun run --cwd apps/guides lighthouse:ci     # CI mode: requires out/ to exist
```

[ogs]: https://github.com/jshemas/openGraphScraper
