# @packrat/utils Sweep Findings (U2)

Read-only sweep of `packages/` and `apps/` (excluding node_modules, dist, build, .next,
.expo, *.gen.ts, src/codegen, test files). Goal: seed the curated `@packrat/utils` facade.

## Summary

- **~9 candidate exports** identified, **4 meaningful duplication clusters**, **~25 raw-primitive sites**.
- Duplication is **moderate, not heavy**. The single highest-value targets are:
  `capitalize` / `title` (string), `group` (array), `sum`/`sumBy` (math), `sleep` (async),
  `unique` (array), `clamp` (math).
- Most "debounce/throttle/slugify" hits are **already library-backed** (`use-debounce`,
  `slugify`, Reanimated's `clamp`) — do NOT re-implement those; they are not migration targets.
- Weight conversion (`toGrams`/`fromGrams`/`convertToGrams`) is **domain logic with its own
  home (`packages/units`)** — explicitly OUT of scope for `@packrat/utils`. See Notes.
- **Recommended first-wave facade surface (ship in U3):**
  `string`: `capitalize`, `title`; `array`: `group`, `unique`, `sort`;
  `math`: `sum`, `sumBy`, `clamp`, `round`; `async`: `sleep`, `tryit`.

## Recommended facade exports (prioritized)

| Export | Category | Best source lib | Why this lib | Call sites / duplication count |
|--------|----------|-----------------|--------------|-------------------------------|
| `capitalize` | string | **radashi** | TS-native, top priority, has it; matches `s[0].toUpperCase()+s.slice(1)` exactly | ~5 raw sites |
| `title` (Title Case) | string | **radashi** | radashi `title` handles word-splitting + capitalizing; collapses the `.split().map(cap).join()` idiom | ~6 raw sites (the multi-word capitalizers) |
| `group` (groupBy) | array | **radashi** | TS-native, returns `Partial<Record<K,T[]>>`, priority #1; es-toolkit `groupBy` is a fine alt | 1 hand-rolled (`gear-inventory.tsx`) + several DB `.groupBy` (N/A) |
| `unique` (dedupe) | array | **radashi** | priority #1, supports key fn; replaces `[...new Set]` / `Array.from(new Set)` | 4 raw sites |
| `sum` | math | **radashi** | priority #1, has `sum(arr, fn?)`; covers most `.reduce((a,b)=>a+b,0)` | ~10 raw `reduce`-sum sites |
| `sumBy` | math | **es-toolkit** | radashi `sum` takes a mapper but `sumBy` reads cleaner for `sum + item.weight*qty`; es-toolkit is TS-native #3, radashi has no separate `sumBy` | subset of the sum sites |
| `clamp` | math | **radashi** | priority #1 has `clamp(n,min,max)`; replaces `Math.min(Math.max(...))` | 2 raw sites (catalog/packs `validLimit`) |
| `round` (to precision) | math | **es-toolkit** | `round(n, precision)`; radashi has no precision-rounding. Replaces `Math.round(x*100)/100` | several (analytics, compute-pack) — see Notes |
| `sleep` | async | **radashi** | priority #1, `sleep(ms)`; replaces `new Promise(r=>setTimeout(r,ms))` | ~6 raw sites |
| `tryit` | async | **radashi** | already in use; keep as facade re-export (see Known sites) | 1 site |

## Duplication clusters

1. **Title-case a hyphen/space-delimited string** — `str.split(...).map(w => w.charAt(0).toUpperCase()+w.slice(1)).join(...)`
   - `apps/expo/features/guides/hooks/useGuideCategories.ts:18-19`
   - `apps/expo/features/guides/screens/GuideDetailScreen.tsx:62`
   - `apps/expo/features/guides/components/GuideCard.tsx:35`
   - `apps/expo/features/ai/components/GuidesRAGGenerativeUI.tsx:79`
   - `apps/web/components/screens/gear-inventory-screen.tsx:12-13`
   - **Collapses to:** `title(str)` (radashi) — or `capitalize` per-word if split is needed.

2. **Single-word capitalize** — `category.charAt(0).toUpperCase() + category.slice(1)`
   - `apps/guides/components/footer.tsx:63`
   - `apps/guides/components/header.tsx:85,156`
   - `apps/guides/components/filterable-guides.tsx:35`
   - **Collapses to:** `capitalize(str)` (radashi).

3. **Sum a numeric field over a list** — `arr.reduce((sum,x)=>sum + x.field, 0)`
   - `apps/web/components/screens/packs-screen.tsx:350,426`
   - `apps/web/components/screens/shopping-list-screen.tsx:84,85`
   - `apps/expo/features/packs/hooks/usePackWeightAnalysis.ts:10,18` (with a unit-convert mapper)
   - `apps/admin/components/dashboard/dashboard-content.tsx:31,32`
   - `packages/api/src/utils/compute-pack.ts:110`
   - **Collapses to:** `sum(arr, x => x.field)` (radashi) or `sumBy` (es-toolkit).

4. **Dedupe an array** — `[...new Set(...)]` / `Array.from(new Set(...))`
   - `apps/guides/scripts/build-content.ts:58`
   - `apps/expo/app/(app)/ai-chat.tsx:241`
   - `packages/api/src/routes/packs/index.ts:544`
   - `packages/api/src/routes/catalog/index.ts:147` (`Array.from(new Set(ids))`)
   - **Collapses to:** `unique(arr)` (radashi).

## Raw-primitive sites

| Site | Pattern | Canonical facade replacement |
|------|---------|------------------------------|
| `apps/guides/scripts/build-content.ts:58` | `[...new Set(...flatMap)]` | `unique(...)` |
| `apps/expo/app/(app)/ai-chat.tsx:241` | `Array.from(new Set(map))` | `unique(...)` |
| `packages/api/src/routes/packs/index.ts:544` | `Array.from(new Set(map.filter))` | `unique(...)` |
| `packages/api/src/routes/catalog/index.ts:147` | `Array.from(new Set(ids))` | `unique(ids)` |
| `apps/expo/app/(app)/gear-inventory.tsx:51-62` | manual `reduce` groupBy w/ `assertDefined` | `group(items, i => i.category ?? 'Other')` |
| `packages/api/src/routes/catalog/index.ts:545` | `Math.min(Math.max(limit,1),20)` | `clamp(limit, 1, 20)` |
| `packages/api/src/routes/packs/index.ts:882` | `Math.min(Math.max(limit,1),20)` | `clamp(limit, 1, 20)` |
| `apps/web/lib/data.ts:67` | `const delay = ms => new Promise(r=>setTimeout(r,ms))` | `sleep(ms)` |
| `apps/guides/lib/enhanceGuideContent.ts:208`, `apps/guides/scripts/enhance-content.ts:305`, `apps/guides/scripts/generate-content.ts:482`, `packages/api/container_src/server.ts:268,271` | `await new Promise(r=>setTimeout(r,N))` | `sleep(N)` |
| `apps/web/components/screens/profile-screen.tsx:69` | `packs.reduce((a,p)=>a+p.baseWeight,0)/packs.length` | `mean(packs, p=>p.baseWeight)` (radashi) / `meanBy` (es-toolkit) |
| sum-reduce sites in cluster 3 | `reduce((s,x)=>s+x.f,0)` | `sum(arr, x=>x.f)` / `sumBy` |
| capitalize/title sites in clusters 1-2 | `charAt(0).toUpperCase()...` | `capitalize` / `title` |
| `packages/api/src/utils/compute-pack.ts:111`, `packages/analytics/src/core/spec-parser.ts:85,101`, `entity-resolver.ts:312` | `Math.round(x*100)/100` | `round(x, 2)` (es-toolkit) — see Notes (judgment call) |

**Object map-building (`Object.fromEntries(arr.map(r => [k, v]))`)** — many sites in
`packages/api/src/routes/admin/analytics/platform.ts:77-79,154-156`, `feed/index.ts:76,78,305`,
`apps/admin/components/analytics/*.tsx`. These are lookup-map builds. radashi `objectify(arr, k, v)`
is a clean replacement but the inline `Object.fromEntries` is already terse and type-safe; **low
priority** — recommend leaving unless touched.

## Known radash sites (migration map for U10/U4)

| Site | Symbol | Replacement |
|------|--------|-------------|
| `packages/analytics/src/core/local-cache.ts:12,605` | `tryit` (radash) | Re-export `tryit` from `@packrat/utils/async` (radashi `tryit`). Swap import to `@packrat/utils`. |
| `apps/expo/features/pack-templates/components/FeaturedPacksSection.tsx:5,58` | `isArray` (radash) | **Guard, not util.** Migrate to `@packrat/guards` `isArray` (U4). Not a `@packrat/utils` export. |
| `packages/guides/src/index.ts:25` | barrel re-export from `radash` | Handled in **U4** (guards barrel). Noted only. NOTE: actual path is `packages/guards/src/index.ts:25` (no `packages/guides` package exists). |

These are the only three `radash`/`radashi` import sites in non-test source. Confirmed via grep
for `from 'radash'` / `from 'radashi'`.

## Notes / judgment calls

- **Weight conversion is OUT of scope.** `toGrams`/`fromGrams`/`gramsToLbs`
  (`packages/app/src/shared/lib/weight.ts`), `convertToGrams`/`convertFromGrams`
  (`apps/expo/features/packs/utils/`), and duplicates in `apps/web/lib/data.ts`,
  `packages/api/src/utils/weight.ts`, `packages/analytics/src/core/spec-parser.ts` are **domain
  logic** with a dedicated package `packages/units` (`normalize`, `convert`, `displayWeight`,
  `parseWeightUnit`). Consolidating those belongs to a units-package effort, not `@packrat/utils`.
  Flagging the duplication for awareness only.
- **debounce/throttle: do NOT re-implement.** Expo uses `use-debounce` (`useDebounce`,
  `useDebouncedCallback`) which is the correct React-hook form; AI chat uses the AI SDK's
  `experimental_throttle`; admin uses nuqs `throttleMs`. A bare `debounce`/`throttle` facade
  export is fine to *offer* (radashi/es-toolkit both have them) but there are **no hand-rolled
  timers to migrate**, so it's not first-wave.
- **slugify: leave as-is.** `apps/guides` already depends on the `slugify` package;
  `packages/api/src/routes/wildlife/index.ts:62` has a tiny inline slugify — single site, not
  worth a facade export. radashi `dash` is close but not URL-slug-equivalent.
- **`clamp` in Expo messages** (`chat.tsx`, `conversations.tsx`) is **Reanimated's worklet
  `clamp`** (runs on UI thread) — must NOT be swapped for a JS-thread util. Only the two API
  `Math.min(Math.max())` sites are real targets.
- **`round(x, precision)`**: radashi has **no** precision-rounding helper; es-toolkit `round`
  does. The `Math.round(x*100)/100` idiom recurs in analytics/compute-pack. Worth a facade export
  (`round` from es-toolkit) but lower confidence — many of these are intertwined with weight/unit
  domain math, so migrate opportunistically.
- **Library coverage confirmed by introspection** (`node -e require(...)`): radashi exports
  `group, sum, unique, sort, sleep, debounce, throttle, retry, memo, tryit, range, mapValues,
  pick, omit, capitalize, title, dash, snake, camel, pascal, clamp, objectify, mapEntries`.
  es-toolkit adds the ones radashi lacks: `sumBy, meanBy, round`. lodash retains
  `toFinite, toNumber, sumBy, meanBy, round, clamp` (kept for old-school primitives per plan).
  remeda has equivalents but ranks last; no candidate needed it as best source.
- **`sortBy`**: many `.sort((a,b)=>...)` sites exist but most are bespoke multi-key/date
  comparators (e.g. `usePackWeightHistory.ts`, `guides/index.ts`). A generic `sort`/`sortBy`
  facade (radashi `sort` / es-toolkit `sortBy`) helps the simple single-numeric-key cases
  (`compute-pack.ts:118`, `data.ts:1312`) but is medium-value, not first-wave.
- **pick/omit/memoize/once/retry/compose/pipe**: searched, **no hand-rolled implementations
  found** in source. Offer them in the facade for completeness (cheap, well-typed in radashi),
  but they have zero current migration sites.
