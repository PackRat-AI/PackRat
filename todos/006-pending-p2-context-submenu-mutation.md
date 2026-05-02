---
status: pending
priority: p2
issue_id: "006"
tags: [code-review, security, quality, web-shims]
dependencies: []
---

# createContextSubMenu / createDropdownSubMenu Mutate Passed Objects

## Problem Statement

In `index.web.tsx`:
```ts
export const createContextSubMenu = (subMenu: object, items: unknown[]) =>
  Object.assign(subMenu, { items });
```
`Object.assign` mutates `subMenu` in place. If the same object is reused across calls (or caller retains reference expecting immutability), shared state is corrupted. Also opens a theoretical prototype pollution vector if an object with `__proto__` is passed.

## Findings

- Security reviewer (L3 finding) flagged mutation + prototype risk
- Architecture reviewer noted same pattern
- Call sites in `conversations.tsx` and `chat.tsx` pass local object literals today (low immediate risk)

## Proposed Solutions

### Option A: Return a new spread object (Recommended)
```ts
export const createContextSubMenu = (subMenu: object, items: unknown[]) =>
  ({ ...subMenu, items });
export const createDropdownSubMenu = (subMenu: object, items: unknown[]) =>
  ({ ...subMenu, items });
```
**Effort:** Trivial. **Risk:** None (same external API, immutable return).

## Acceptance Criteria
- [ ] Both functions return new objects (no mutation)
- [ ] Existing call sites unaffected

## Work Log
- 2026-05-01: Found during ce:review (security-sentinel agent)

## Resources
- `packages/ui/nativewindui/index.web.tsx` — createContextSubMenu and createDropdownSubMenu
