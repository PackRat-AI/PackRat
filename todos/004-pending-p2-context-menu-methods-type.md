---
status: pending
priority: p2
issue_id: "004"
tags: [code-review, typescript, architecture, web-shims]
dependencies: []
---

# ContextMenuMethods Type Not Exported from Web Barrel

## Problem Statement

`apps/expo/app/(app)/messages/chat.tsx` imports `type { ContextMenuMethods }` from `@packrat/ui/nativewindui`. This type is not exported from `index.web.tsx`. The root tsconfig excludes `*.web.tsx` from native compilation, so this gap is invisible during `bun check-types` — it will surface when a web-targeted tsc run is added to CI.

## Findings

- Architecture reviewer confirmed the import exists in `chat.tsx`
- `ContextMenuMethods` is a View-derived native type with no web equivalent
- The tsconfig exclusion approach creates this specific blind spot

## Proposed Solutions

### Option A: Stub type export (Recommended)
Add to `index.web.tsx`:
```tsx
export type ContextMenuMethods = Record<string, never>;
```
**Effort:** Tiny. **Risk:** None.

### Option B: Add web tsconfig that checks .web.tsx files
Add `packages/ui/tsconfig.web.json` with `react-jsx` and `browser` conditions to catch these gaps in CI.
**Effort:** Medium. **Risk:** Low.

## Acceptance Criteria
- [ ] `type { ContextMenuMethods }` import from `@packrat/ui/nativewindui` resolves on web
- [ ] No runtime value is exported (type only)

## Work Log
- 2026-05-01: Found during ce:review (architecture-strategist agent)

## Resources
- `packages/ui/nativewindui/index.web.tsx`
- `apps/expo/app/(app)/messages/chat.tsx`
