# PackRat Testing Guide

PackRat uses **Vitest** across every workspace that runs tests. This document is the source of truth for:

- the **per-workspace coverage thresholds** that each Vitest config enforces
- the **coverage ratchet** that gates PRs in CI against regression
- the **assertion-strength lint** that catches coverage theater
- per-pattern testing conventions for services, fetch mocking, and pure utilities

The current numbers below reflect the state of the configs on `main`. The policy that produced them is tracked in `docs/plans/2026-05-19-001-chore-coverage-ratchet-and-quality-gates-plan.md` (and its 2026-05-17 predecessor).

---

## Coverage Thresholds — Two Layers

PackRat gates coverage at **two layers** that fail builds for different reasons:

1. **Vitest per-config thresholds** (declared in each workspace's `vitest.config.ts` / `vitest.unit.config.ts`) fail that workspace's coverage run when *its own* numbers drop below the floor.
2. **The coverage ratchet** (`scripts/lint/coverage-ratchet.ts` + `coverage-baselines.json`) fails the build when *any* tracked workspace drops below the baseline recorded for it on the last green `main`. The ratchet defends the threshold itself — if a PR lowers a Vitest threshold and the coverage drops accordingly, the Vitest gate passes but the ratchet does not.

Current per-workspace thresholds (all four metrics: lines / branches / functions / statements):

| Workspace | Lines | Branches | Functions | Statements |
|---|---:|---:|---:|---:|
| `packages/api` (unit suite) | 95 | 92 | 97 | 95 |
| `apps/expo` | 95 | 92 | 97 | 95 |
| `packages/mcp` | 95 | 90 | 95 | 95 |
| `packages/analytics` | 80 | 80 | 85 | 80 |
| `packages/overpass` | 80 | 70 | 80 | 80 |
| `packages/units` | 100 | 100 | 100 | 100 |

`packages/api` integration tests (the `@cloudflare/vitest-pool-workers` suite in `vitest.config.ts`) are **not** counted toward coverage. V8 coverage is unsupported under the Workers pool and the Istanbul path has an open upstream regression. The unit suite (`vitest.unit.config.ts`) is the coverage source of truth for that workspace. Integration tests still run in `api-tests.yml`.

Untracked (no coverage threshold today): `apps/{admin,trails,web,landing,guides}`, `packages/{cli,osm-db,osm-import,web-ui,api-client,ui,guards,env,app,checks,config}`. These are deferred to follow-up plans.

---

## Coverage Ratchet

Every PR is gated by a ratchet that fails CI if any workspace's coverage drops below the baseline in `coverage-baselines.json` (committed at the repo root).

```bash
# Local check — reads each workspace's coverage/[unit/]coverage-summary.json
# and compares to coverage-baselines.json. Exits 1 on any regression.
bun check:coverage
```

On a green push to `main`, the consolidated coverage workflow (deferred to a follow-up plan) auto-commits any baseline improvements back to `coverage-baselines.json` via:

```bash
bun check:coverage:update
```

The baseline only ever moves up. There is no manual edit step in the normal flow.

To run coverage for a single workspace:

```bash
bun run --cwd packages/api test:unit:coverage
bun run --cwd apps/expo test:coverage
bun run --cwd packages/mcp test --coverage
bun run --cwd packages/analytics test --coverage
bun run --cwd packages/overpass test --coverage
bun run --cwd packages/units test --coverage
```

To run the unit suite for the scripts themselves:

```bash
bun test:scripts
```

When a workspace's coverage genuinely improves, the ratchet's output reports the improvement and prints what the baseline-update script would commit — but day-to-day you don't apply it by hand: CI does it on merge to `main`.

---

## Assertion-Strength Lint

`scripts/lint/no-weak-assertions.ts` walks every `*.test.ts` / `*.test.tsx` file under `apps/*` and `packages/*` and flags four coverage-theater patterns:

| Rule | Flags |
|---|---|
| `assertion-free-test` | `it(...)` / `test(...)` blocks with zero `expect(...)` calls. Helper assertions (any call whose name starts with `expect`, e.g. `expectUnauthorized(res)`, `expectJsonResponse(res)`) count as assertions and prevent this rule from firing. |
| `only-tobedefined` | `it(...)` blocks whose only assertions are `.toBeDefined()`, `.toBeTruthy()`, `.toBeFalsy()`, `.not.toBeUndefined()`, or `.not.toBeNull()`. **`.toBeUndefined()` and `.toBeNull()` alone are NOT flagged** — they assert specific return values. |
| `bare-tohavebeencalled` | `.toHaveBeenCalled()` without a matching `.toHaveBeenCalledWith(...)` or `.toHaveBeenCalledTimes(N)` in the same block. |
| `large-snapshot` | `toMatchInlineSnapshot(...)` body > 50 lines. |

Run with:

```bash
bun lint:weak-assertions
```

File-level escape hatch: `// no-weak-assertions: disable` in the first 5 lines of a file skips the entire file. Use sparingly — grandfathered tests only.

---

## Test Patterns

### Pattern 1 — Service tests with mocked dependencies

```ts
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { CatalogService } from '../catalogService';
import * as embeddingService from '@packrat/api/services/embeddingService';

vi.mock('@packrat/api/db', () => ({
  createDb: vi.fn(),
  createDbClient: vi.fn(),
}));

vi.mock('@packrat/api/services/embeddingService', () => ({
  generateEmbedding: vi.fn(),
  generateManyEmbeddings: vi.fn(),
}));

describe('CatalogService', () => {
  let service: CatalogService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new CatalogService(makeEnv(), false);
  });

  describe('vectorSearch', () => {
    beforeEach(() => {
      vi.mocked(embeddingService.generateEmbedding).mockResolvedValue(
        new Array(1536).fill(0.1),
      );
    });

    it('returns empty result for empty query string', async () => {
      const result = await service.vectorSearch('', 10, 0);
      expect(result).toEqual({
        items: [],
        total: 0,
        limit: 10,
        offset: 0,
        nextOffset: 10,
      });
      expect(embeddingService.generateEmbedding).not.toHaveBeenCalled();
    });
  });
});
```

Reference: `packages/api/src/services/__tests__/catalogService.test.ts`

Key points:
- `vi.mock()` for module-level mocks (hoisted to the top of the file).
- `import * as service` then `vi.mocked(service.fn)` for type-safe mock assertions.
- `vi.clearAllMocks()` in `beforeEach()` for test isolation.

### Pattern 2 — API service tests with fetch mocking

```ts
beforeEach(() => {
  vi.clearAllMocks();
  fetchMock = vi.fn();
  global.fetch = fetchMock;
});

it('returns formatted weather data for valid location', async () => {
  fetchMock.mockResolvedValue({
    ok: true,
    json: async () => ({ main: { temp: 72.5, humidity: 65 }, weather: [{ main: 'Clear' }] }),
  });
  const result = await service.getWeatherForLocation('San Francisco');
  expect(result.temperature).toBe(73);
  expect(result.conditions).toBe('Clear');
});
```

Reference: `packages/api/src/services/__tests__/weatherService.test.ts`

### Pattern 3 — Pure utility function tests

```ts
import { describe, expect, it } from 'vitest';
import { convertToGrams } from '../convertToGrams';

describe('convertToGrams', () => {
  describe('metric conversions', () => {
    it('returns same value for grams', () => {
      expect(convertToGrams(100, 'g')).toBe(100);
      expect(convertToGrams(0, 'g')).toBe(0);
    });

    it('converts kilograms to grams correctly', () => {
      expect(convertToGrams(1, 'kg')).toBe(1000);
      expect(convertToGrams(2.5, 'kg')).toBe(2500);
    });
  });

  describe('edge cases', () => {
    it('handles zero weight', () => {
      expect(convertToGrams(0, 'kg')).toBe(0);
    });

    it('returns original value for unknown units', () => {
      expect(convertToGrams(100, 'invalid')).toBe(100);
    });
  });
});
```

Reference: `apps/expo/features/packs/utils/__tests__/convertToGrams.test.ts`

Floating-point comparisons:

```ts
// Avoid exact equality for floats
expect(convertToGrams(1, 'oz')).toBeCloseTo(28.3495, 4);
```

### Pattern 4 — Integration tests (`packages/api/test/*.test.ts`)

Run with `bun test` from `packages/api/`. Requires Docker (Postgres + neon-wsproxy via `docker-compose.test.yml`). Auth helpers live in `packages/api/test/utils/test-helpers.ts` — use `apiWithAuth`, `apiWithAdmin`, `apiWithApiKey`, never construct sessions by hand.

Test fixtures must seed users through `userService.createUser`. Do not write new integration tests that `db.insert(users).values(...)` directly.

### Pattern 5 — Swift visual E2E catalog

The native Swift apps have a visual catalog runner that drives `VisualScreenshotTests` on iOS and macOS, exports every named screenshot, validates the required surface matrix, and renders contact sheets for review.

```bash
# Full iOS + macOS visual pass. Requires E2E credentials.
bun swift:screenshots --out artifacts/screenshots

# Platform-specific runs while iterating.
bun swift:screenshots --platform ios --out artifacts/screenshots
bun swift:screenshots --platform macos --out artifacts/screenshots

# Rebuild contact sheets from existing captured PNGs without rerunning Xcode.
bun swift:screenshots --skip-tests --out artifacts/screenshots
```

The runner writes:
- `ios-contact-sheet.png` / `macos-contact-sheet.png` for the full spread.
- Grouped sheets for unauthenticated, guest, guest limits, offline, authenticated, seeded data, detail, expanded controls, and modal states.
- `ios-xctest/coverage-manifest.json` and `macos-xctest/coverage-manifest.json`, which map required screenshot names to feature areas and flows.
- `run-summary.json` with artifact paths and xcresult summaries when tests ran.

CI runs the same catalog through `.github/workflows/swift-visual.yml` on a nightly schedule and by manual dispatch. The workflow uploads the contact sheets and visual `.xcresult` bundles as `swift-visual-screenshots`. macOS visual runs require Automation Mode to be available on the runner; locally, run `automationmodetool enable-automationmode-without-authentication` once before leaving the suite unattended.

---

## What to Test (Priority Order)

For every feature-bearing implementation unit, include scenarios from each category that applies:

1. **Happy path** — core functionality with expected inputs and outputs.
2. **Edge cases** — boundary values, empty inputs, nullish states, concurrent access.
3. **Error paths** — invalid input, downstream service failures, timeout behavior, permission denials.
4. **Integration** — behaviors that mocks alone will not prove (callback chains, middleware, multi-layer interactions).

Avoid testing:
- Third-party library internals.
- Pure getters/setters with no logic.
- Generated code (drizzle migrations, OpenAPI types).
- Configuration files.
- Pure type definitions.

---

## Commands

```bash
# Per-workspace coverage
bun test:api:unit         # packages/api unit suite (Node env, all deps mocked)
bun test:expo             # apps/expo pure-TS tests
bun test:mcp              # packages/mcp
bun run --cwd packages/units test
bun run --cwd packages/overpass test
bun run --cwd packages/analytics test

# Integration (requires Docker)
bun run --cwd packages/api test     # full pool-workers integration suite

# Coverage gates
bun check:coverage         # ratchet against coverage-baselines.json
bun lint:weak-assertions   # custom lint over test files

# Scripts test suite (ratchet + lint analyzer)
bun test:scripts

# Swift native apps
bun swift                 # regenerate the Xcode project after project.yml or source tree changes
bun test:swift:scripts    # TypeScript helper tests for simctl/xcresult/script parsing
bun swift:screenshots     # visual E2E catalog for iOS + macOS
```

Coverage reports for each workspace:
- `packages/api/coverage/unit/index.html`
- `apps/expo/coverage/unit/index.html`
- `packages/mcp/coverage/index.html`
- `packages/analytics/coverage/index.html`
- `packages/overpass/coverage/index.html`
- `packages/units/coverage/index.html`

---

## Troubleshooting

### "Cannot access before initialization" in test files

`vi.mock()` calls are hoisted to the top of the file by Vitest. Variables declared after the hoisted mock cannot be referenced inside it.

```ts
// Won't work
const mockFn = vi.fn();
vi.mock('./module', () => ({ fn: mockFn }));

// Works
vi.mock('./module', () => ({ fn: vi.fn() }));
import * as module from './module';
// Use vi.mocked(module.fn) inside tests
```

### Mock not resetting between tests

Always call `vi.clearAllMocks()` in `beforeEach()`. Without it, call histories leak across tests.

### Floating-point precision errors

```ts
expect(0.1 + 0.2).toBeCloseTo(0.3, 10);  // 10 decimal places
```

### Coverage ratchet fails locally but passes in CI

Coverage outputs are workspace-local. Make sure you ran `--coverage` for the workspace that's failing — the ratchet treats a missing `coverage-summary.json` as a regression on purpose (silent skipping is exactly the mode the gate exists to prevent).

### Lint flags a legitimate test as `assertion-free-test`

Helpers whose names start with `expect` count as assertions. If your helper is named differently (e.g., `assertResponseShape(res)`), the lint will not see it. Either rename to `expectShape(res)` or add the file-level `// no-weak-assertions: disable` comment.

---

## Resources

- [Vitest Documentation](https://vitest.dev/)
- [Cloudflare Vitest pool — known issues](https://developers.cloudflare.com/workers/testing/vitest-integration/known-issues/) (why integration tests are not coverage-instrumented)
- The plan that established the ratchet + lint policy: `docs/plans/2026-05-19-001-chore-coverage-ratchet-and-quality-gates-plan.md`
