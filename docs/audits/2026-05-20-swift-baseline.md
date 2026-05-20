# Swift app ship-readiness baseline — 2026-05-20

Tracks the as-found state of `apps/swift/` on branch `claude/swift-mac-app-effort-tTGd7` at the start of the ship-readiness stack. Each section is populated by the corresponding unit in `docs/plans/2026-05-20-001-feat-swift-mac-and-ios-ship-readiness-plan.md`.

## Environment

| Item | Value |
|---|---|
| Branch | `claude/swift-mac-app-effort-tTGd7` |
| Branch head | `04bf85d6d` (🧪 fix: get all e2e tests passing) |
| Worktree | `.claude/worktrees/swift-ship-audit/` |
| Divergence vs main | 92 ahead, 904 behind |
| Xcode | 26.5 (Build 17F42) |
| Available iOS runtime | iOS 26.5 only (deployment target in `project.yml` is iOS 17.0) |
| Available macOS runtime | host macOS Tahoe (deployment target is macOS 14.0) |
| xcodegen | 2.45.4 (installed via brew during U1) |
| Simulator used for U2 baseline | iPhone 17 Pro (UDID: 626B2C47-CC06-46AF-8132-70E9D866AEA8) |
| Bun packages | 1763 installed cleanly |

## Build verification (U1)

| Scheme | Configuration | Destination | Result |
|---|---|---|---|
| PackRat-iOS | Debug | iPhone 17 Pro (iOS 26.5) | ✅ `xcodebuild build` exit 0, no errors, 4 warnings (see below) |

### iOS Debug build warnings

Build succeeds but surfaces 4 latent warnings on the current head. None block ship; capturing here so U7 (OpenAPI regen) can clean them up:

- `Sources/PackRat/Features/TrailConditions/TrailConditionsView.swift:98:38` — `??` on non-optional `String` (`report.overallCondition`). Dead defensive check after a generated-type tightening.
- `Sources/PackRat/Features/TrailConditions/TrailConditionsView.swift:200:43` — same pattern, same field.
- `Sources/PackRat/Services/CatalogService.swift:17:34` — `??` on non-optional `[CatalogItem]` (`wrapped.items`).
- `Sources/PackRat/Network/APIClient.swift:137:28` — `await` on a non-async block (`Task { await self.clearRefreshTask() }` inside `defer`).

The first three are signals that the generated OpenAPI types have tightened nullability since the call sites were written — U7's regen will likely shift this further. The last is a minor structural cleanup independent of API contract.
| PackRat-macOS | Debug | platform=macOS | _deferred; runs in U6_ |

## XCUITest baseline (U2)

| Metric | Value |
|---|---|
| Test plan invoked | _U3 has not added test plans yet; U2 runs the full default scheme_ |
| Tests collected | _pending_ |
| Pass | _pending_ |
| Fail | _pending_ |
| Skipped | _pending_ |
| Wall clock | _pending_ |
| `xcresult` bundle | _pending_ |

### Failing tests

_To be populated by U2._

## macOS runtime audit (U6)

_To be populated by U6._

## API client drift (U7)

**Two blockers surfaced during the ce-work parallel pass; U7 cannot proceed as written without addressing both first:**

1. **`bun generate:openapi` is broken on the swift branch.**

   ```text
   $ bun generate:openapi
   error: Cannot find package 'cloudflare:workers' from
     'node_modules/@cloudflare/containers/dist/lib/container.js'
   ```

   Root cause: `packages/api/src/routes/packTemplates/index.ts` imports `getContainer` from `@cloudflare/containers`, whose `container.js` imports the virtual `cloudflare:workers` module. The module is only resolvable inside the Workers runtime. Vitest's unit config aliases it to `packages/api/src/__test-stubs__/cloudflare-workers.ts`; the bun-driven script has no equivalent alias.

   Fix options: (a) add a Bun preload that registers the stub via `--preload`, (b) refactor `@cloudflare/containers` imports to lazy / dynamic so the spec-build path doesn't hit them, or (c) generate the spec from a running `bun api` dev server (curl `/doc`) instead.

2. **The two swift OpenAPI YAML siblings disagree.**

   `apps/swift/openapi.yaml` and `apps/swift/PackRatAPIClient/Sources/PackRatAPIClient/openapi.yaml` differ — but `generate-openapi.ts` writes both atomically, so they should be byte-identical. One was likely hand-edited after regen, breaking the build-plugin invariant. U7 must reconcile (likely "regenerate both") before relying on either.

**Implication:** U7's "drop new spec into swift package, run `bun swift:codegen`" approach assumes generate-openapi works. Until blocker 1 is resolved, U7's path is either (a) fix generate-openapi first as a sub-task, (b) curl `/doc` from `bun api` and write the spec manually, or (c) hand-author the spec — which is fragile and reverts what generate-openapi was meant to mechanize.

3. **The swift YAML specs are hand-curated, not generator output.**

   While unblocking via `bun api` on port 8788 + `curl /doc`, the deeper structural issue surfaced:

   - The `/doc` endpoint returns JSON with **0 component schemas** (90 paths). Elysia's OpenAPI plugin uses inline schemas at every route definition, not extracted component refs.
   - The two swift `openapi.yaml` files are **real YAML** starting with `openapi: "3.1.0"` and contain extracted `components.schemas` — hand-curated, more structured than what Elysia emits.
   - `generate-openapi.ts` writes `JSON.stringify(spec, null, 2)` to files named `.yaml`. Those files would not match the format the swift YAML files use.

   **What this means:** the existing `generate-openapi.ts` does not actually produce the YAML files swift consumes. Someone has been hand-authoring or transforming the spec. The "regen" U7 imagines may not exist — U7 is asking to regenerate something that has no clean source-of-truth path.

   **Resolution path for a focused U7 session (not this ce-work session):**
   - Decide canonical authorship: is the swift YAML hand-curated (and stays so), or does generate-openapi need to be rewritten to emit a swift-compatible YAML with extracted component schemas?
   - If hand-curated: rename `generate-openapi.ts` or scope it to JSON-only, and treat the swift YAML as a separately-maintained artifact that the audit must reconcile against the live route surface manually.
   - If auto-generated: rewrite generate-openapi to (a) extract inline schemas into `components.schemas`, (b) emit YAML (not JSON), (c) match the existing swift YAML's structural conventions.
   - Either way, the live `/doc` spec at `localhost:8788/doc` is the source-of-truth of route surface. A diff between that and `apps/swift/PackRatAPIClient/Sources/PackRatAPIClient/openapi.yaml` enumerates the API drift that U8 / decision-artifact need to score.

   **Status:** U7 punted from this session — needs user input on the canonical-authorship direction before further work makes sense.

## URL realignment (U8)

**Precondition check failed.** Per a P1 doc-review finding, U1 probed the URLs the plan commits to:

| URL | DNS | HTTP | Notes |
|---|---|---|---|
| `https://api.packrat.app/` | NXDOMAIN | n/a | The canonical production URL the plan asserts in R4 does not exist |
| `https://staging-api.packrat.app/` | NXDOMAIN | n/a | Likewise — staging domain is not live |
| `https://packrat-api.orange-frost-d665.workers.dev/` | resolves | `HTTP/2 200` | The workers.dev URL the Swift app currently hardcodes IS the live production API |

**Implication for R4 / U8.** The `packages/api/src/utils/openapi.ts` `servers:` list naming `api.packrat.app` is documentation only — the workers.dev URL is the actual production endpoint. R4's literal claim ("production API base URL points to `https://api.packrat.app`") is unsatisfiable until a custom domain is configured on the Cloudflare Worker. U8 cannot deliver as written; needs replanning before execution.

**Decision needed before U8 fires.** Either (a) set up `api.packrat.app` as a custom domain on the Worker (out of audit scope per R10), or (b) restate R4 to track the canonical-by-runtime URL (`packrat-api.orange-frost-d665.workers.dev` today) and document the custom-domain follow-up explicitly. Capturing as a blocker for the U8 task.


## Sentry baseline (U9)

_To be populated by U9._

## Deep linking parity (U10)

_To be populated by U10._

## Feature flag parity (U11)

_To be populated by U11._

## Decision artifact reference (U13)

Final decision lives at `docs/audits/2026-05-20-decision-ios-swap.md`; parity matrix at `docs/audits/2026-05-20-feature-parity-matrix.md`.
