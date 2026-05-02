---
status: pending
priority: p3
issue_id: "012"
tags: [code-review, architecture, web-shims]
dependencies: ["011"]
---

# Circular Import: theme-toggle.web.tsx → index.web.tsx

## Problem Statement

`theme-toggle.web.tsx` imports `useColorScheme` from `./index.web`. Since `index.web.tsx` re-exports `ThemeToggle` from `./theme-toggle.web`, there is a circular module dependency. Metro handles this at runtime via lazy loading, but TypeScript's language service can get confused, and initialization ordering bugs are possible if the cycle grows.

## Findings

- TypeScript reviewer (Medium) and architecture reviewer (Moderate) both flagged this
- The cycle: `index.web.tsx` → `theme-toggle.web.tsx` → `index.web.tsx`
- Metro CommonJS lazy loading makes this work today, but it's a structural smell

## Proposed Solutions

### Option A: Extract useColorScheme to use-color-scheme.web.ts (Recommended)
Move `useColorScheme`, `STUB_COLORS`, and `DARK_STUB_COLORS` to `packages/ui/nativewindui/use-color-scheme.web.ts`. Both `index.web.tsx` and `theme-toggle.web.tsx` import from there. Cycle broken.
**Effort:** Small. **Risk:** Low.

## Acceptance Criteria
- [ ] No circular import between theme-toggle and index barrel
- [ ] ThemeToggle still works correctly
- [ ] `useColorScheme` still exported from index.web.tsx

## Work Log
- 2026-05-01: Found during ce:review

## Resources
- `packages/ui/nativewindui/theme-toggle.web.tsx`
- `packages/ui/nativewindui/index.web.tsx`
