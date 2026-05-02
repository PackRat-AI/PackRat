---
status: pending
priority: p2
issue_id: "010"
tags: [code-review, typescript, web-shims]
dependencies: []
---

# ICON_MAP[name] Conflicts with noUncheckedIndexedAccess

## Problem Statement

```ts
const LucideComponent: LucideIcon = ICON_MAP[name] ?? Circle;
```
With `noUncheckedIndexedAccess: true` (inherited via expo tsconfig), `ICON_MAP[name]` resolves to `LucideIcon | undefined`. The `?? Circle` fallback handles runtime, but the explicit type annotation `LucideIcon` forces assignment of `LucideIcon | undefined` to `LucideIcon` — TypeScript rejects this.

## Findings

- TypeScript reviewer (High severity) flagged this
- Root tsconfig has `noUncheckedIndexedAccess: true`
- `.web.tsx` files are excluded from root tsconfig but included by expo tsconfig which extends root

## Proposed Solutions

### Option A: Remove the explicit type annotation (Recommended)
```ts
const LucideComponent = ICON_MAP[name] ?? Circle;
```
TypeScript infers `LucideIcon | undefined`, then the `?? Circle` fallback narrows it to `LucideIcon`. Type-safe, no annotation needed.
**Effort:** Trivial. **Risk:** None.

## Acceptance Criteria
- [ ] `bun check-types` passes with no error on `icon.web.tsx`
- [ ] Fallback to `Circle` for unknown names still works

## Work Log
- 2026-05-01: Found during ce:review (kieran-typescript-reviewer)

## Resources
- `packages/ui/nativewindui/icon.web.tsx`
