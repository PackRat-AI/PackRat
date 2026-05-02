---
status: pending
priority: p3
issue_id: "015"
tags: [code-review, performance, web-shims, bundle-size]
dependencies: []
---

# 60 Lucide Imports May Pull Full 224KB Barrel

## Problem Statement

`icon.web.tsx` imports ~60 named icons from `lucide-react` root barrel. Metro does not perform named-export tree-shaking within a module — it traces the module graph. If Metro resolves `lucide-react` to the ESM barrel (224 KB, 1,947 icons), every chunk that uses `Icon` carries 97% wasted icon payload.

## Findings

- Performance reviewer (P0) flagged this as the single largest potential bundle regression
- Lucide v1.x ships per-icon `.mjs` subpath exports (~180 bytes each)
- Whether Metro tree-shakes depends on how `lucide-react` package exports are configured

## Proposed Solutions

### Option A: Switch to per-icon subpath imports (Recommended)
```ts
import { Circle } from 'lucide-react/icons/circle';
import { Search } from 'lucide-react/icons/search';
```
**Pros:** Only referenced icons in bundle.
**Cons:** More verbose import block.
**Effort:** Small. **Risk:** Low.

### Option B: Audit current bundle output first
Run `METRO_BUNDLE_ANALYZE=1` or check bundle size before/after. If lucide-react ships proper `sideEffects: false` and Metro is using its ESM exports correctly, barrel may already be shaken.
**Effort:** Small. **Risk:** None.

## Acceptance Criteria
- [ ] Bundle size verified before/after
- [ ] If barrel is full-size: switch to per-icon imports

## Work Log
- 2026-05-01: Found during ce:review (performance-oracle agent)

## Resources
- `packages/ui/nativewindui/icon.web.tsx`
