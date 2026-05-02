---
status: pending
priority: p1
issue_id: "002"
tags: [code-review, typescript, web-shims]
dependencies: []
---

# Missing `import type * as React` in Three Shim Files

## Problem Statement

`text-field.web.tsx`, `search-input.web.tsx`, and `icon.web.tsx` use `React.` namespace for type references (`React.ChangeEventHandler`, `React.ReactNode`, `React.CSSProperties`, `React.Ref`, `React.ChangeEvent`) but none import the `React` namespace. The new JSX transform handles JSX without a React import, but it does not inject the namespace for explicit type references. TypeScript will error on these under `strict: true`.

## Findings

From TypeScript reviewer:
- `text-field.web.tsx`: uses `React.ChangeEventHandler`, `React.ReactNode`, `React.CSSProperties`, `React.Ref`
- `search-input.web.tsx`: uses `React.ChangeEventHandler`, `React.ReactNode`
- `icon.web.tsx`: uses `React.CSSProperties`
- All three import named exports from `react` (forwardRef, useId, useEffect) but not the namespace

## Proposed Solutions

### Option A: Add `import type * as React from 'react'` (Recommended)
Add to each of the three files. The `type` modifier keeps it type-only with zero bundle impact.
**Effort:** Small. **Risk:** None.

### Option B: Replace namespace usage with direct type imports
e.g., `import type { CSSProperties } from 'react'` and replace `React.CSSProperties` → `CSSProperties`
**Pros:** More explicit, no namespace needed.
**Cons:** More lines to change.
**Effort:** Small. **Risk:** None.

## Acceptance Criteria
- [ ] `bun check-types` passes with no React namespace errors
- [ ] Biome passes (import should be `import type`)

## Work Log
- 2026-05-01: Found during ce:review (kieran-typescript-reviewer)

## Resources
- `packages/ui/nativewindui/text-field.web.tsx`
- `packages/ui/nativewindui/search-input.web.tsx`
- `packages/ui/nativewindui/icon.web.tsx`
