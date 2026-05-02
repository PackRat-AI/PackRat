---
status: pending
priority: p3
issue_id: "013"
tags: [code-review, typescript, quality, web-shims]
dependencies: []
---

# AlertMethods Exported as Runtime Value Instead of Type

## Problem Statement

```ts
export const AlertMethods = {};
```
Screen code does `import { Alert, type AlertMethods }`. On native `AlertMethods` is a type. Exporting it as a runtime value pollutes the module's runtime surface and gives type `{}` which is nearly unconstrained.

## Findings

- Architecture reviewer (Significant) and TypeScript reviewer (Low) both flagged this
- Should be `export type AlertMethods = Record<string, never>`

## Proposed Solutions

### Option A: Change to type export (Recommended)
```ts
export type AlertMethods = Record<string, never>;
```
And remove `export const AlertMethods = {};`.
**Effort:** Trivial. **Risk:** None.

## Acceptance Criteria
- [ ] `AlertMethods` is a type-only export
- [ ] No runtime value exported for AlertMethods

## Work Log
- 2026-05-01: Found during ce:review

## Resources
- `packages/ui/nativewindui/index.web.tsx`
