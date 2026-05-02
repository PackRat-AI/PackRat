---
status: pending
priority: p2
issue_id: "009"
tags: [code-review, typescript, quality, web-shims]
dependencies: []
---

# Unsafe rest Spread Cast in button.web.tsx

## Problem Statement

```ts
{...(rest as Partial<ShadcnButtonProps>)}
```
`ButtonProps` does not extend `ShadcnButtonProps`. The cast is unsound — it lets any leftover prop flow to the DOM `<button>` without type verification. Native-only props not listed in `ButtonProps` would be spread onto a DOM element, generating React unknown prop warnings.

## Findings

- TypeScript reviewer (High severity) and simplicity reviewer both flagged this
- `androidRootClassName` is explicitly destructured and discarded — but any other native prop not listed will flow through
- The cast `Partial<ShadcnButtonProps>` is not a valid assertion of what `rest` actually contains

## Proposed Solutions

### Option A: Remove the rest spread entirely (Recommended for PoC)
The existing named props cover all real use cases. Removing `...rest` eliminates the risk.
**Effort:** Trivial. **Risk:** None for current call sites.

### Option B: Properly type the component
Define `ButtonProps` as extending `Omit<ShadcnButtonProps, 'variant' | 'size' | 'onClick'>` and let TypeScript validate the intersection.
**Effort:** Medium. **Risk:** Low.

## Acceptance Criteria
- [ ] No unsound type cast on button props
- [ ] No unknown DOM prop warnings in browser console
- [ ] `bun check-types` passes

## Work Log
- 2026-05-01: Found during ce:review (kieran-typescript-reviewer)

## Resources
- `packages/ui/nativewindui/button.web.tsx`
