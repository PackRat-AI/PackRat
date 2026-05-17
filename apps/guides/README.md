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
| `bun run lighthouse` | Build + run LHCI assertions |
| `bun run sync-to-r2` | Sync content to `packrat-guides` R2 bucket |
