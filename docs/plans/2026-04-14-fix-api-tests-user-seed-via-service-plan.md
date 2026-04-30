---
title: Fix api-tests by seeding users through a service func, not raw inserts
type: fix
status: active
date: 2026-04-14
---

# Fix api-tests by seeding users through a service func

## Overview

After #2170 merged, `api-tests` is still red on `development`. Every test that uses `seedTestUser()` and then references `user_id` hits `FK constraint "*_user_id_users_id_fk"` — the user isn't reliably present at FK-check time. Root cause isn't the global `beforeEach` TRUNCATE; it's a cluster of assumptions that only held by accident:

1. Fixtures (`createTestPackTemplate`, `createTestPack`, `TEST_USER`) hardcode `userId: 1`, assuming `TRUNCATE ... RESTART IDENTITY` + auto-generated serial means "the first seeded user is always id 1."
2. Under the new `@neondatabase/serverless` + wsproxy path (post-#2170), connection/session semantics differ enough that this assumption is no longer load-bearing reliably.
3. `seedTestUser` does a raw `db.insert(users).values({...}).returning()` — no password hashing, no validation, no service-level side effects (OTP setup, welcome flow). It's out of sync with what the real register path produces.

There is no `userService.createUser` — the registration logic lives inline in `packages/api/src/routes/auth/index.ts:231`. The fix is to extract it and have tests seed through it.

## Problem statement

- **Immediate**: api-tests red; blocks every subsequent PR that touches api.
- **Structural**: test fixtures lie about user IDs; any code path that relies on the returned id rather than `1` starts failing the moment sequence assumptions shift. This already tripped on the wsproxy cutover and will trip again on any future refactor that touches connection lifecycle.
- **Duplication**: `seedTestUser` ≠ what `/auth/register` produces. Tests are validating behaviors against a user shape that doesn't match production's register output.

## Proposed solution

Three steps, roughly independently shippable but best as one PR:

1. **Extract `userService.create`** from `packages/api/src/routes/auth/index.ts:231` (the `registerRoute` handler). Move the password hashing + DB insert + initial state setup into `packages/api/src/services/userService.ts`. Route handler calls the service; behavior unchanged.
2. **Rewrite `seedTestUser`** in `packages/api/test/utils/user-helpers.ts` to call `userService.create`. Return the real DB user (real id, real hash, real state).
3. **Remove hardcoded `userId: 1`** from fixtures. `TEST_USER` becomes a convenience const for defaults (email, name) — not the id. Tests read the id off the returned user.

## Acceptance criteria

- [ ] `packages/api/src/services/userService.ts` exports `createUser` with the same behavior as the current inline register handler (hash password, insert, return user).
- [ ] `registerRoute` in `auth/index.ts` is reduced to "validate input → call service → shape response."
- [ ] `seedTestUser` calls `userService.create`; no `db.insert(users)` in test helpers.
- [ ] Grep for `TEST_USER.id`, `userId: 1`, and `user_id=1` in `packages/api/test/` returns zero results (or only intentional negative-test cases).
- [ ] `api-tests` green on CI for this branch.
- [ ] No new failing tests; non-api CI stays green.

## Out of scope

- Switching cleanup to `reset(testDb, schema)` via `drizzle-seed` — good follow-up, not required for this fix.
- Extracting services for the other auth endpoints (login, OTP, password reset). Separate refactor.
- Changing the TRUNCATE → DELETE cleanup strategy or the tablesToClean list.
- Admin / pre-verified / OAuth user states — if tests need them, they call `userService.create` then a second helper or direct `db.update` for the state tweak.

## Implementation steps

1. **Branch** (done): `fix/api-tests-user-seed-via-service` off `origin/development`.
2. **Extract service.** Read `packages/api/src/routes/auth/index.ts:231-320` (registerRoute handler). Identify the pure "create user" portion (hash + insert + returning). Move to `packages/api/src/services/userService.ts` as `createUser({ email, password, firstName, lastName, role?, emailVerified? })`. Re-export from `services/index.ts`. Update `registerRoute` to call it.
3. **Verify extraction** with existing auth tests (they should still pass — register behavior unchanged).
4. **Swap `seedTestUser`** in `packages/api/test/utils/user-helpers.ts` to call `userService.createUser`. Preserve its `overrides` signature.
5. **Kill hardcoded IDs.** In fixtures (`createTestPackTemplate`, `createTestPack`, etc.), remove the `userId: 1` default — force callers to pass a real id. In tests, capture the seeded user's id and pass it through.
6. **Run api-tests locally** (once env token is available) or push and watch CI.
7. **Open PR** against `development` with this plan linked.

## Risks

- Extraction touches the hottest route in the repo. Mitigation: keep the extraction mechanical — move code, don't refactor behavior in the same commit.
- Some tests may rely on `TEST_USER.id = 1` for things other than FK (e.g., JWT signing for synthetic tokens). Grep will find them; update to use the seeded user's id.
- Password hashing per-test adds latency. bcrypt/argon cost at test setting is <150ms; across a test suite with `beforeEach`, plausible 10-30s overhead. Acceptable. If not, lower the test-time cost factor via a config knob.

## Sources & references

- `packages/api/src/routes/auth/index.ts:231` — current registerRoute handler (extraction source)
- `packages/api/test/utils/user-helpers.ts` — current `seedTestUser`
- `packages/api/test/utils/test-helpers.ts:17` — `TEST_USER` with hardcoded `id: 1`
- `packages/api/test/fixtures/pack-template-fixtures.ts:17` — `userId ?? 1` default
- PR #2170 (merged) — introduced the wsproxy path that exposed the fixture fragility
- `docs/plans/2026-04-14-chore-narrow-pr-2170-spike-scope-plan.md` — preceding plan for the spike narrowing
