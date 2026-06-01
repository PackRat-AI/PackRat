# ast-grep parity with retired regex lint scripts

Maps each behavior of the old `scripts/lint/no-raw-typeof.ts` and
`scripts/lint/no-raw-regex.ts` to the ast-grep rules that replace them. The old
`.ts` scripts are left in place until the orchestrator confirms this proof.

## no-raw-typeof.ts → `no-raw-typeof.yml` (+ `no-raw-typeof-tsx.yml`)

| Old-script behavior | ast-grep coverage |
|---|---|
| Flags `typeof X === <primitive>` / `!==` | `rule.any` of `typeof $X === $T` / `typeof $X !== $T` |
| Primitive set: string,number,boolean,object,function,undefined,symbol,bigint | `constraints.T.regex` exactly that set, quote-anchored |
| Exempt globals window/document/globalThis/Bun/navigator/process | `constraints.X.not.regex` for those identifiers |
| Scanned only `apps/` + `packages/`, skipped node_modules/dist/build/.wrangler | `ignores` for `scripts/**`, `.github/**`, mocks; ast-grep already skips ignored/build dirs via repo .gitignore |
| Exempt `packages/guards/**` | `ignores: **/packages/guards/**` (plus `packages/utils/**`) |
| Exempt `*.test`/`*.spec` files | `ignores` for `*.test.{ts,tsx}` / `*.spec.{ts,tsx}` |
| Only matched `.ts/.tsx/.cts/.mts` | typescript-language rule + tsx-language twin for `.tsx` |

**Stricter than the old script (real bugs the line-regex MISSED):** the old
identifier regex `[A-Za-z_][A-Za-z0-9_.]*` did not match optional chaining or
bracket access, so it silently skipped `typeof options?.md5 === 'string'`
(packages/api/src/services/r2-bucket.ts) and `typeof entry[0] === 'string'`
(packages/api-client/src/index.ts). ast-grep's `$X` metavar matches any
expression, catching all of these. The `.tsx` twin also catches
`packages/web-ui/src/components/chart.tsx`. All migrated (see report).

## no-raw-regex.ts → `no-raw-regex.yml` (+ `no-raw-regex-tsx.yml`)

| Old-script behavior | ast-grep coverage |
|---|---|
| Flags `new RegExp(...)` | `pattern: new RegExp($$$ARGS)` |
| Flags `.replace/.replaceAll/.match/.matchAll/.test/.split/.search(/.../)` | method `any` + `has: {field: arguments, has: {kind: regex}}` (top-level regex literal arg only — mirrors the old `(/` heuristic, no over-match into nested calls) |
| Scope apps/+packages/ non-test | same `ignores` set as typeof |
| Allowlist enrichment.ts + alltrails.ts | `ignores` entries for both files |
| Biome `performance/useTopLevelRegex` covers the strict AST case | noted in rule `message` |

## no-raw-json (new) → `no-raw-json*.yml`

Not part of parity (no old script). `severity: warning` so CI is not gated.
`JSON.parse($X)`→`safeJsonParse($X)` and single-arg `JSON.stringify($X)`→
`safeJsonStringify($X)` carry autofix `fix:`. Multi-arg stringify is flagged without
autofix (no clean 1:1 rewrite). Import insertion is out of scope.

## no-primitive-cast (new) → `no-primitive-cast*.yml` (+ `-tsx` twin)

Not part of parity (no old script). Complements `packages/checks/check-type-casts.ts`,
which deliberately exempts single-word lowercase types (`if (LOWERCASE_TYPE.test(castType)) continue;`)
and so never flags `as string` / `as number` / `as boolean`. This rule fills that gap:
it matches an as-expression to a primitive type (`$X as string|number|boolean`) and steers
authors to a `@packrat/guards` narrow (`toString`/`toNumber`/`toBoolean`, `as*` aliases) or an
explicit coercion (`String`/`Number`/`toFloat`/`toInt`). No double-reporting — the two checks
cover disjoint cast shapes (named types vs. primitives). `as const` / `as unknown` / `as T[]`
are not primitive single-type assertions and are naturally excluded by the pattern. Same
`ignores` scope as the typeof rules (guards/utils/tooling/test files). `severity: warning`
because ~63 primitive casts already exist (mostly `apps/expo`); burn the backlog down, then
promote to `error`.
