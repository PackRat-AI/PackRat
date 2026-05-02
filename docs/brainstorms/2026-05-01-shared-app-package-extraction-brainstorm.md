---
date: 2026-05-01
topic: shared-app-package-extraction
---

# Shared Logic Extraction — How Much Can Move to a `packages/domain` Package?

## What We're Building

A shared `packages/domain` package (or `packages/app`) containing platform-agnostic business logic: types, domain utils, data-fetching hooks, and Jotai store definitions — usable by both the Expo app today and a future Next.js web app without changes to either consumer.

## Why This Approach

The monorepo already proves the pattern works: `@packrat/api-client` is fully platform-agnostic because it injects auth adapters from the consumer layer rather than importing them directly. The same injection pattern can unlock 35–40% of feature code in `apps/expo/features/` for sharing. Screens and components (the irreducibly platform-specific 40%) stay in each app. Logic moves to shared packages.

## Current State (from audit)

**Already shared:** `api-client`, `guards`, `env`, `config` — well-architected boundaries.

**`apps/expo/features/` breakdown (307 files):**

| Category | Files | Shareable? |
|---|---|---|
| Screens (`screens/*.tsx`) | 39 | No — expo-router, RN layout primitives |
| Components (`components/*.tsx`) | 84 | No — View, Text, TouchableOpacity |
| Hooks (`hooks/*.ts`) | 98 | ~30% clean now, ~70% light surgery |
| Stores/Atoms | 18 | Medium — logic clean, persistence RN |
| Utils + Types | ~68 | ~60% clean, ~40% RN/Expo |

**Rough extractable: 35–40% of feature code.**

## Key Decisions

**1. The injection pattern is the unlock.**
`@packrat/api-client` already does this for auth. Apply the same to:
- **Navigation**: hooks pass callbacks (`onSuccess: () => router.push(...)`) rather than importing `expo-router` directly
- **Storage**: Jotai atom persistence layer injected at app startup, not inside the atom definition
- **Image picking**: `useImagePicker` wraps `expo-image-picker`; extract the mutation logic, inject the picker as a callback

**2. Easy wins (zero refactor, move tomorrow):**
- `packs/utils/convertToGrams.ts`, `convertFromGrams.ts`, `computePackWeights.ts` — unit math with tests
- `catalog/lib/normalizeDescription.ts` — string formatter
- All domain types: `packs/types.ts`, `trips/types.ts`, `catalog/types.ts`
- ~29 hooks that grep clean (no `react-native`/`expo` imports): `useAllPacks`, `useRecentPacks`, `useUserPackItems`, `useCategoriesCount`, etc.

**3. Medium effort (~30 min per hook/store):**
- `useCreatePack`, `useUpdatePack` etc.: query logic is clean; navigation side-effects are the only entanglement. Lift navigation out as an `onSuccess` callback parameter.
- Jotai stores: atom *definitions* are platform-agnostic; only `persistPlugin` + `kvStorage` are Expo-specific. Split: `domain` exports the atom shape, Expo app wraps with persistence.
- `authAtoms.ts`: imports `kvStorage` (MMKV). Same pattern — inject the storage adapter.

**4. Screens and components do NOT move.** They are irreducibly platform-specific by definition. This is fine — the value is in sharing the logic layer, not the view layer.

**5. JSX/logic split assessment:**
The split already mostly exists structurally (`.ts` hooks vs `.tsx` screens). The entanglement is in **platform side-effects used inside otherwise pure hooks** — specifically `expo-router` for navigation callbacks and `expo-*` for device APIs. These can be lifted out via the injection pattern without restructuring anything major.

## What This Enables

A future Next.js app can `import { useAllPacks, computePackWeights } from '@packrat/domain'` and get all the data-fetching and business logic for free. It builds its own screens and components on top. No shared JSX, no shared navigation — just shared models and queries.

## Open Questions

- **Package name**: `packages/domain`, `packages/app`, or `packages/core`? Domain is most accurate.
- **Migration strategy**: move all at once vs feature-by-feature? Feature-by-feature (start with `packs`) reduces risk.
- **Jotai on Next.js**: Jotai works fine in Next.js App Router with a Provider. Not a blocker.
- **tRPC/eden client on Next.js**: `@packrat/api-client` already platform-agnostic. Needs HTTP transport config, not a code change.

## Next Steps

→ `/ce:plan` to create `packages/domain` with the packs feature as the first migration target.
