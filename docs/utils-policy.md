# `@packrat/utils` — Utility Policy

`@packrat/utils` is the single, curated, type-safe home for general-purpose
utilities in the monorepo. Type **narrowing / guards** live in
`@packrat/guards`, not here. This doc is the rule a future maintainer (or agent)
applies without archaeology.

## The rule

1. **Never hand-roll a utility that a blessed lib already provides.** Import it
   from `@packrat/utils` (or add it to the facade). Re-implementing a facade
   export is caught by `no-duplicate-utils`.
2. **Never import the underlying libs directly** outside `packages/utils`.
   `radashi`, `radash`, `es-toolkit`, `lodash`, and `remeda` are banned
   everywhere else by Biome's `noRestrictedImports`. `@packrat/utils` is the
   only package allowed to reach them.
3. **Never raw `JSON.parse` / `JSON.stringify`.** Use `safeJsonParse` /
   `safeJsonStringify` (or `stableJsonStringify`) from `@packrat/utils/json`. Enforced by
   the `no-raw-json` ast-grep rule.

## Source priority (soft)

When more than one lib provides a function, prefer them in this order — but the
real tiebreaker is **best types + has-the-function**, not rigid rank:

1. **radashi** — TS-native, the maintained radash fork; the default source.
2. **radash** — legacy; only for parity gaps radashi hasn't filled.
3. **es-toolkit** — TS-native, tree-shakeable; chosen when it has a function or
   capability the higher-priority libs lack (e.g. `round` with precision,
   `sumBy`/`meanBy`/`maxBy`/`minBy`, `chunk`).
4. **lodash** — kept available for old-school primitives the modern libs dropped.
   _Currently sources no first-wave export_ (radashi covers `toFloat`/`toInt`);
   enrolled so it's there the moment a lodash-only need appears.
5. **remeda** — TS-native dataLast; the composition primitive (`pipe`).

A deliberate lower-priority pick is legal **only when recorded** in the
provenance manifest with a `reason` (see below). `round` is the current example.

## Re-export vs wrap

- **Default: thin re-export.** Most exports are a one-line `export { x } from 'lib'`.
- **Wrap only when it earns it:** to normalize to repo conventions (single-object
  args for Biome `useMaxParams: 2`, consistent naming) or to compose a primitive
  the libs lack. The `json` helpers are the current wrap/compose example
  (configured stringifiers + a typed `destr` wrapper).
- Do **not** add speculative exports. The surface grows from real usage and the
  duplication the sweep / `jscpd` surface (`docs/utils-sweep-findings.md`).

## Provenance contract

`src/provenance.ts` records, per export: `{ source, alsoIn?, reason? }`.
`check-utils-provenance` (in `packages/checks`) enforces:

- every barrel export has exactly one manifest entry, and vice-versa (no stale rows);
- `source` is a known lib;
- if any `alsoIn` lib outranks `source` in `LIB_PRIORITY`, `reason` is non-empty.

Adding or removing an export means updating the manifest in the same change — the
check fails CI otherwise.

## Organization

One barrel (`@packrat/utils`) plus category subpaths: `@packrat/utils/array`,
`/object`, `/string`, `/async`, `/fn`, `/math`, `/json`. The root barrel
re-exports every category. Import from the root or a subpath — both resolve to
the same implementation.
