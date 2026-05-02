---
status: pending
priority: p2
issue_id: "008"
tags: [code-review, quality, web-shims, ux]
dependencies: []
---

# onSubmitEditing Not Wired in SearchInput Web Shim

## Problem Statement

`SearchInput` accepts `onSubmitEditing?: () => void` in its props type but the web shim never wires it to the `<input>` element. Users pressing Enter in a search box on web get no response. This is a functional regression from native behavior.

## Findings

- Agent-native reviewer flagged this as the only functional gap in the shim layer
- `search-input.web.tsx` has `onSubmitEditing` in type but not in the JSX
- Affects web users; agents are unaffected (they call tools directly)

## Proposed Solutions

### Option A: Add onKeyDown Enter handler (Recommended)
```tsx
onKeyDown={(e: React.KeyboardEvent<HTMLInputElement>) => {
  if (e.key === 'Enter') onSubmitEditing?.();
}}
```
**Effort:** Small. **Risk:** None.

### Option B: Wire to a wrapping `<form>` with onSubmit
Wrap in `<form onSubmit={...}>` for proper browser form semantics.
**Pros:** Better accessibility (browser handles Enter natively).
**Effort:** Small. **Risk:** Low.

## Acceptance Criteria
- [ ] Pressing Enter in SearchInput on web calls `onSubmitEditing`
- [ ] Existing keyboard behavior unchanged

## Work Log
- 2026-05-01: Found during ce:review (agent-native-reviewer agent)

## Resources
- `packages/ui/nativewindui/search-input.web.tsx`
