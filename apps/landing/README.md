# PackRat Landing

Next.js 15 static-export marketing site for PackRat. Deployed to Cloudflare
Pages from `apps/landing/out/`.

## Build pipeline

The `build` script in `package.json` runs:

```
bun run generate-og-images   →  next build
```

- `scripts/generate-og-images.ts` renders a real `public/og-image.png`
  from the same JSX used in `app/opengraph-image.tsx`. Static exports
  cannot serve Next.js metadata-route images correctly from a CDN —
  the `.body`/`.meta` files Next emits are a Next.js-internal format —
  so we write a plain PNG to `public/` instead.
- `next build` produces the static export in `out/`.

## Useful scripts

| Script | Purpose |
|---|---|
| `bun run dev` | Local Next.js dev server |
| `bun run generate-og-images` | Render `public/og-image.png` |
| `bun run build` | Full static build (`out/`) |
| `bun run test` | Vitest suite (metadata + og-image PNG checks) |
| `bun run test:og-meta` | Parse built HTML and assert OG / Twitter meta tags |
| `bun run lighthouse` | Build + run LHCI assertions locally |
| `bun run lighthouse:ci` | Run LHCI against an already-built `out/` (CI mode) |

## Open Graph metadata validation

All PackRat web apps share the same OG validation pattern (see
[`apps/guides/README.md`](../guides/README.md) for the full rationale and
the per-post variant). Layers:

1. **Image generation** — `bun run generate-og-images` produces
   `public/og-image.png` at 1200×630. `__tests__/og-image.test.ts` asserts
   the file exists, has the PNG signature, and matches expected dimensions.
2. **Static meta in built HTML** — `bun run test:og-meta` runs
   `bun run build` (if `out/` is missing) and parses every
   `out/*.html` plus `out/<slug>/index.html` with cheerio. It asserts the
   required tags (`og:title`, `og:description`, `og:image`,
   `og:image:width`, `og:image:height`, `og:type`, `og:url`,
   `og:site_name`, `twitter:card`, `twitter:title`, `twitter:description`,
   `twitter:image`) are present on every page and that `og:image` is an
   absolute `https://` URL pointing at the site-wide image (`/og-image.png`
   or the Next.js auto-generated `/opengraph-image` route).
   This step runs in the `Builds` workflow on every PR.
3. **Live OG meta on a deployed URL** — opt-in via
   `OG_LIVE_CHECK_URL=https://packratai.com bun run test:og-meta`.
   Hits the live origin via [`open-graph-scraper`][ogs] (the same parser
   most platforms use under the hood) and asserts the same shape.
   Skipped by default.

### Manual validators

For one-off checks after a deploy:

- [opengraph.xyz](https://www.opengraph.xyz/) — quick visual preview
- [microlink.io](https://microlink.io/) — JSON view of every OG / Twitter tag
- [Facebook Sharing Debugger](https://developers.facebook.com/tools/debug/) — also flushes FB's cache
- [LinkedIn Post Inspector](https://www.linkedin.com/post-inspector/) — also flushes LI's cache

## Lighthouse CI

`.lighthouserc.js` (desktop) and `.lighthouserc.mobile.js` (mobile) drive
LHCI against the static `out/` directory. Budgets:

- Performance ≥ 0.8
- Accessibility ≥ 0.9
- Best Practices ≥ 0.9
- SEO ≥ 0.9
- LCP < 2500 ms (desktop) / 4000 ms (mobile)
- CLS < 0.1
- TBT < 300 ms (desktop) / 600 ms (mobile)

The `Builds` GitHub Actions workflow runs `lighthouse:ci` after the OG
meta test on every PR and surfaces the scores in the GitHub Step Summary.
The step is marked `continue-on-error: true` — perf regressions appear as
a yellow check on the PR rather than a hard block, so reviewers can decide
whether a deploy is worth tightening the threshold for.

To run locally:

```
bun run --cwd apps/landing lighthouse        # full: build + LHCI
bun run --cwd apps/landing lighthouse:ci     # CI mode: requires out/ to exist
```

[ogs]: https://github.com/jshemas/openGraphScraper
