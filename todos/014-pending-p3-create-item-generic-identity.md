---
status: pending
priority: p3
issue_id: "014"
tags: [code-review, typescript, quality, web-shims]
dependencies: []
---

# createContextItem / createDropdownItem Should Be Generic Identity Functions

## Problem Statement

```ts
export const createContextItem = (item: unknown) => item;
export const createDropdownItem = (item: unknown) => item;
```
The return type is `unknown`. Call sites build arrays of these items and pass them to menu components. With `unknown` return type, the array type is `unknown[]`, which TypeScript will reject when passed to typed component props.

## Findings

- TypeScript reviewer flagged this (Low)
- Call sites in `chat.tsx` and `conversations.tsx` pass shaped objects

## Proposed Solutions

### Option A: Generic identity function (Recommended)
```ts
export const createContextItem = <T,>(item: T): T => item;
export const createDropdownItem = <T,>(item: T): T => item;
export const createContextSubMenu = <T extends object>(subMenu: T, items: unknown[]): T & { items: unknown[] } =>
  ({ ...subMenu, items });
export const createDropdownSubMenu = <T extends object>(subMenu: T, items: unknown[]): T & { items: unknown[] } =>
  ({ ...subMenu, items });
```
**Effort:** Trivial. **Risk:** None.

## Acceptance Criteria
- [ ] `createContextItem` preserves the type of its argument
- [ ] No `unknown[]` array types at call sites

## Work Log
- 2026-05-01: Found during ce:review (kieran-typescript-reviewer)

## Resources
- `packages/ui/nativewindui/index.web.tsx`
