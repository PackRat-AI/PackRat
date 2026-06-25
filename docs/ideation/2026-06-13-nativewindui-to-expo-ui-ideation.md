---
date: 2026-06-13
topic: nativewindui-to-expo-ui-migration
focus: migrate from nativewindui to expo ui
mode: repo-grounded
---

# Ideation: nativewindui → Expo UI Migration

## Grounding Context

**Codebase shape:** Bun monorepo (3 web + 1 mobile). Mobile app (apps/expo): Expo SDK 56, React Native 0.85, NativeWind v4.2.3. Uses rn-primitives packages (alert-dialog, avatar, checkbox, etc.) and wraps them with `@packrat-ai/nativewindui` v2.2.0. 177 nativewindui imports across 87 files. Team maintains custom TextInput, Button, SearchInput components in `apps/expo/components/`. Recent Expo 56 + React Native 0.85 upgrade (June 2026).

**Notable patterns:** Feature modules in `apps/expo/features/{name}/` with own components, hooks, screens. Styling via NativeWind (Tailwind for RN) + CSS variable-based color system. State: Jotai (local), React Query (server), Legend State (reactive). Forms: TanStack React Form + Zod. E2E: Maestro with stable testID selectors from `lib/testIds.ts`. Feature flags in `apps/expo/config.ts`. EAS Build with dev/preview/e2e/production profiles + EAS Updates.

**Pain points:** (1) GitHub Packages token requirement (PACKRAT_NATIVEWIND_UI_GITHUB_TOKEN friction). (2) Type breaking changes (AlertRef → AlertMethods, LargeTitleSearchBarRef → LargeTitleSearchBarMethods) affecting 18+ files per release. (3) Hard to diagnose platform-specific bugs when wrappers hide root causes (Android TextInput keyboard focus issue documented in `docs/solutions/ui-bugs/`). (4) Monolithic nativewindui package (50+ components, but PackRat uses only 15-20).

**Leverage points:** rn-primitives actively maintained (v1.4.0, March 2026) and covers ~80% of use cases. @expo/ui stable in SDK 56 (same platform PackRat already upgraded to). Web apps (guides, landing) use Shadcn/Radix UI, enabling cross-platform code reuse via rn-primitives foundation. Team already maintains thin wrappers (components/TextInput.tsx shows pattern works).

**Past learnings:** Institutional experience (Android TextInput bug, documented solution) revealed that wrapper patterns hide root causes. Solution: thin enhancement wrappers (hooks + useImperativeHandle) on top of native APIs. Systematic import migration required. Keep platform-specific wraps minimal.

**External context:** @expo/ui built on New Architecture (JSI + Fabric). rn-primitives is Radix UI-equivalent for RN (actively maintained, same foundation as web apps). React Native Reusables (copy-own model) gaining traction in ecosystem. NativeBase effectively dead. NativeWind v5 has migration friction (lightningcss issue) — recommend staying on v4 for now, independent of this migration.

---

## Ranked Ideas

### 1. Monomorphism: Migrate One Component at a Time
**Description:** Pick the highest-impact, lowest-risk component (Text: 27 imports) and migrate all 27 import sites in one PR. Create `apps/expo/components/Text.tsx` wrapping @expo/ui or rn-primitives Text, update all imports, test on device, ship. Repeat for Button (15 imports), then LargeTitleHeader (7), then Refs (Alert, Sheet, ContextMenu). Frontload simple components; ones with ref-forwarding requirements go last.

**Rationale:** Boring is reliable. No clever abstractions, no generators, no runtime swapping—just straightforward component migration. Each PR becomes an audit trail of what moved and when. Grounded in team practice: `apps/expo/components/TextInput.tsx` (custom wrapper with keyboard fix) and `components/Button.tsx` show the team already maintains thin wrappers and owns their component code. CLAUDE.md emphasizes explicit, auditable code over clever tricks. Allows feature teams to work in parallel (one team handles Text migration, another ships new features simultaneously). Clear success metric: all import sites updated, tests pass, device testing validates behavior.

**Downsides:** Takes weeks, not days (~1 week per 3-4 components given 87 files). Requires discipline to avoid ad-hoc deviations mid-migration (e.g., "while we're migrating Button, let's also refactor its styles"). Mechanical find-and-replace errors are possible (missing an import site leaves dead code). No single "migration complete" moment; rather, a gradual completion per component.

**Confidence:** 95%

**Complexity:** Low

**Status:** Unexplored

---

### 2. Two-Layer Stable API (Linux HAL Strategy)
**Description:** Define a minimal, version-stable public API in `packages/ui/` that acts as an adapter layer. This layer wraps only the core components PackRat actually uses (Text, Button, LargeTitleHeader, AlertMethods, Sheet, ListItem). Decouple the implementation: `@packrat-ai/nativewindui` remains the underlying implementation, but PackRat depends on a type and export contract that guarantees stability. When nativewindui updates and type names break (AlertRef → AlertMethods), the breaking change is absorbed *inside* the adapter layer, never exposed to consumers. Implementation: remap types via adapter (`export { Alert as Alert, type AlertMethods as AlertMethods }` + type-only adapters).

**Rationale:** Borrowed from Linux kernel's Hardware Abstraction Layer (HAL) pattern. Kernel internals change; driver code targets the stable HAL, not kernel internals. Institutional grounding: team discovered that platform bugs are easier to fix and diagnose when wrapper layers are thin and their boundaries are explicit. This adapter layer adds ~40-50 lines of code but provides a strong stability contract. Works in parallel with Idea #1 (Monomorphism): migrate Text → adapter guarantees the stable interface → downstream callers update imports once per component, not many times per nativewindui version bump. Reduces the blast radius of upstream breaking changes.

**Downsides:** Adds a layer, which is "one more indirection to understand." Requires discipline to keep the adapter surface minimal and avoid re-exporting unnecessary types or utilities. Requires updating the adapter each time nativewindui updates, but this is a single-file change (packages/ui/nativewindui/index.ts). Type remapping can be fragile if nativewindui's internal types are complex.

**Confidence:** 90%

**Complexity:** Low

**Status:** Unexplored

---

### 3. Dual-Mode Wrapper (Fast + Slow Path)
**Description:** Keep nativewindui as the legacy "slow path" in `packages/ui/nativewindui` (unchanged). Introduce a new "fast path" with thin direct re-exports in `apps/expo/components/{Text,Button,LargeTitleHeader}.tsx` that wrap @expo/ui or rn-primitives directly. Both paths export the same interface. Screens and features can opt-in to the fast path without coordinating a massive migration. Feature teams migrate their imports as they touch a component during normal refactoring; no forced cutover date or migration sprint required.

**Rationale:** Automotive sidecar pattern: applications ran in lightweight containers, but high-velocity features (animations, gestures) used native code directly when container overhead was noticeable. Works because the interface is identical, so callers don't care which implementation they're using. Grounded in reality: `apps/expo/components/TextInput.tsx` and `apps/expo/components/Button.tsx` already exist as thin custom wrappers; the team *likes* owning their component code, maintaining thin wrappers, and having tight feedback loops. Dual-mode + Monomorphism means feature teams drive the migration organically (when the packing-list team refactors, they migrate to fast path; when a feature stays stable, legacy path is fine). Massively reduces coordination burden and shipping delays.

**Downsides:** Maintains two code paths in parallel (increases test matrix slightly—need to test both paths for each component). Requires clear signposting and team convention ("always use fast path for new code, legacy path is for compatibility only"). Teams can diverge if not disciplined (some routes use old, some use new). Slightly higher cognitive load during transition period.

**Confidence:** 93%

**Complexity:** Low-Medium

**Status:** Unexplored

---

### 4. Feature-Flag Component Versions (Staged Rollout)
**Description:** Add feature-flag entries to `apps/expo/config.ts` (e.g., `COMPONENT_TEXT_USE_EXPO_UI: false`, `COMPONENT_BUTTON_USE_EXPO_UI: false`). New components ship with the flag off by default. Conditional rendering in code: if flag is true, use @expo/ui component; else, use nativewindui fallback. Release 1 (preview): flag still off (legacy path active). Release 2 (preview): enable the flag in preview builds only, collect telemetry (Sentry errors, performance, UX metrics) from preview users. Release 3 (prod): if all signals green, ship to 10% of production users (if EAS Segments supports it), then roll to 100%. Revert to nativewindui implementation zero-cost if a regression emerges (just flip the flag off).

**Rationale:** Feature flags are the team's established pattern (already in `apps/expo/config.ts`, EAS profiles are configured). Turns each component migration into a low-risk experiment with instrumented rollback. Grounded in capability: team has EAS Updates, so new component logic can ship without triggering an app store rebuild. Decouples component adoption from SDK releases. Enables continuous design iteration without the traditional "we must wait for iOS App Store review and Android Play Store review" cadence. Supports A/B testing if needed (show @expo/ui Button to 50% of users, nativewindui to the other 50%, compare adoption/satisfaction).

**Downsides:** Adds conditional logic to every component (slight code complexity, requires careful testing of both branches). Requires thinking about what "flag off" means (usually: fall back to nativewindui implementation or keep current behavior). Requires Sentry + analytics to be configured so regressions surface (crashing, poor performance). If a component has many props, conditional rendering can become verbose. Risk of bit rot (a flag left off indefinitely, code path becomes stale).

**Confidence:** 92%

**Complexity:** Low-Medium

**Status:** Unexplored

---

### 5. Vertical Code Reuse (Mobile-Web Convergence)
**Description:** Recognize that rn-primitives (used on mobile via nativewindui) and Radix UI (used on web via Shadcn in `apps/guides` and `apps/landing`) share a compositional foundation. After migrating mobile to rn-primitives-based components, build a bridge package (`@packrat/rn-primitives-web` or similar) that wraps Shadcn components with rn-primitives interfaces. This allows form components, buttons, checkboxes, inputs, etc. to run on all three platforms (iOS/Android/web) from the *same* TypeScript source. Example: a "multiselect items" component built on `@rn-primitives/checkbox` becomes reusable on mobile and web without duplication.

**Rationale:** Strategic multiplier. Today, TextInput on mobile (RN TextInput) and web (Shadcn input) are completely separate codebases. Same for Button, Checkbox, Switch, Select. Unified primitives-based API means form logic, validation, error states, and event handling code compile to both platforms from one source file. Each new form feature (AI-assisted packing suggestions, trip creation flow, outfit builder) lands everywhere automatically. Grounded in market signal: rn-primitives (v1.4.0, March 2026) is actively maintained, has 10+ primitives (alert-dialog, avatar, checkbox, context-menu, dropdown-menu, etc.) that map cleanly to Radix UI's component set. High leverage: form-heavy features become 3x faster to ship.

**Downsides:** Requires design discipline (form components must stay on the rn-primitives interface boundary, not diverge to platform-specific styling tricks). Initial design work is significant (~2-4 weeks to design @packrat/rn-primitives-web adapter + refactor one form as proof-of-concept). Long-term payoff is high but back-loaded (value compounds over quarters as more forms use the bridge). Requires web and mobile teams to coordinate on form contracts.

**Confidence:** 85%

**Complexity:** Medium-High

**Status:** Unexplored

---

### 6. Visual Snapshots + Auto-Regression Detection
**Description:** Snapshot-test the app's visual rendering of each component under both old (nativewindui) and new (@expo/ui) implementations. Use Percy or Detox visual testing tools. For each component migration: old-implementation → screenshot → new-implementation → screenshot → pixel-diff. If they match (pixel-perfect or perceptual distance < 5%), the migration is safe. Before shipping a migrated component to production, require: (1) unit tests pass, (2) E2E tests pass, (3) visual snapshots match old behavior, (4) Maestro flows pass on both iOS and Android.

**Rationale:** Game engines solved "will my game work on UE5 vs. Godot?" by comparing visual output objectively. PackRat learned that AlertRef → AlertMethods broke 18+ files, and type-only fixes might mask rendering regressions. Visual snapshots catch subtle layout shifts, color mismatches, and spacing changes that code review might miss. Grounded in capability: `apps/expo` already runs Maestro E2E tests. Visual snapshot infra (Percy, Detox visual checks) integrates with existing test harness (CI already configured for Maestro). Doesn't require human code review of all 87 files; just "render and diff."

**Downsides:** Requires tooling setup (Percy or Detox integration, ~2-4 hours of CI configuration). Snapshots can be flaky if rendering is non-deterministic (animations, network data loading, dynamic text). Requires a baseline (initial snapshot) that might itself have bugs, so snapshots validate "change is consistent" not "change is correct." Snapshot reviews are manual (diff reviews can be tedious).

**Confidence:** 88%

**Complexity:** Medium

**Status:** Unexplored

---

### 7. Automate Import Migration with Codemod
**Description:** Write a jscodeshift codemod that rewrites all `@packrat/ui/nativewindui` imports to their replacement paths (@expo/ui, rn-primitives, or local components). The codemod patterns matches ~90 import sites automatically (Text: 27 uses → import from new path, Button: 15 uses → new path, etc.). For custom components (LargeTitleSearchBar, FormSection), the codemod leaves them untouched or stubs them with a deprecation comment. Run locally: `jscodeshift -t migration-codemod.js apps/expo/`. Validate output, commit changes. Mechanical work (177 imports across 87 files) becomes a single command + testing.

**Rationale:** Automates the most tedious part of Monomorphism. Team already has precedent: `packages/api/scripts/lint/...` scripts validate generated code in CI. Codemods are standard in TypeScript ecosystem (major framework migrations, e.g., React, use jscodeshift). Reduces human errors (typos, missed imports, inconsistent refactoring). Makes bulk migration mechanical and repeatable—if the codemod is correct once, it's correct every time. Grounded in codebase: 177 imports are high but consistent (mostly Text, Button, Sheet, LargeTitleHeader, ListItem); pattern-matching is straightforward.

**Downsides:** Requires writing + maintaining the codemod (1-2 days upfront). If component APIs differ significantly (e.g., nativewindui's custom props don't exist in @expo/ui), the codemod can't auto-fix everything; those require manual migration or an interim wrapper. Error recovery is manual (if the codemod produces bad code, you must fix it or revert and refine the codemod). Codemod must be validated on a test branch before running on main.

**Confidence:** 87%

**Complexity:** Low-Medium

**Status:** Unexplored

---

## Rejection Summary

**27 ideas rejected.** Common rejection reasons:

- **Duplicates / Subsumed:** Removing wrapper layer entirely (high value but extreme burden; #2 provides 80% benefit with 20% cost). Unblock type-checking (subsumed by #2 adapter layer). Code generation (subsumed by #2). Copy-own UI library (alternative path, but requires ongoing maintenance; primary path is lower effort).
- **Over-Engineering:** Styling primitives + behavioral wrappers (redundant with #2). Component library as sub-libraries (monorepo is simpler). Compiler transform / TypeScript plugin (too expensive for bulk migration; codemod #7 is lighter).
- **Not Aligned with Strategy:** Platform-specific divergence (contradicts PackRat's unified design). Remove CSS (solves non-existent problem; NativeWind is working). Runtime component swapping (powerful but more complex than feature flags).
- **Too Minor:** Eliminate GitHub token (onboarding friction, not blocking). Remove web duplications (1 file, nice-to-have).
- **Not Actionable:** Two-week blitz (stress-driven delivery, unrealistic timeline). Lock in convergence window (artificial deadline). Island components (valuable long-term, but premature before understanding migration impact).

---

## Implementation Sequence (Recommended)

1. **Start:** #2 (Two-Layer Stable API) — set up adapter layer in packages/ui/ as infrastructure for stability.
2. **Parallel:** #1 (Monomorphism) — start with Text component (27 imports), single PR, test thoroughly.
3. **Parallel:** #7 (Automate) — write codemod for next components (Button, LargeTitleHeader).
4. **Validate:** #6 (Visual Snapshots) — set up before shipping migrated components; each component verified.
5. **Rollout:** #4 (Feature Flags) — gate new components, preview testing before prod.
6. **Integrate:** #3 (Dual-Mode) — teams migrate incrementally as they touch features; no forced cutover.
7. **Extend:** #5 (Mobile-Web Reuse) — once core components (Button, Text, Input, Sheet) are stable, build rn-primitives-web adapter for form reuse.

---

## Quality Bar

- ✅ Grounded in codebase context (Expo SDK 56, RN 0.85, 177 imports across 87 files)
- ✅ Candidates generated before filtering (47 ideas across 6 ideation frames)
- ✅ Many-ideas → critique → survivors mechanism preserved
- ✅ Every rejected idea has a documented reason
- ✅ Survivors form coherent strategy (not just individual improvements)
- ✅ Pragmatism prioritized (boring beats clever; existing infrastructure reused)
- ✅ Leverage identified (cross-platform code reuse, ecosystem contribution)
