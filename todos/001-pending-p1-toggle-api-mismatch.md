---
status: pending
priority: p1
issue_id: "001"
tags: [code-review, architecture, runtime-bug, web-shims]
dependencies: []
---

# Toggle API Mismatch — Silent Runtime Bug

## Problem Statement

`index.web.tsx` exports `Switch as Toggle` directly from `@packrat/web-ui`. The shadcn `Switch` uses `checked` + `onCheckedChange`, but nativewindui's `Toggle` (wrapping RN's `Switch`) uses `value` + `onValueChange`. Screen code passes `value`/`onValueChange` (e.g. `weather-alert-preferences.tsx` lines 96–116). On web, the Radix Switch receives unknown props — the toggle renders visually but never responds to interaction.

**Why it matters:** Toggle UI appears functional but is completely broken. Users cannot change toggle state on web. No error is thrown.

## Findings

- Architecture reviewer confirmed screen code at `apps/expo/app/(app)/weather-alert-preferences.tsx:96–116` passes `value`/`onValueChange`
- `@packrat/web-ui` `Switch` component uses `checked`/`onCheckedChange` (Radix UI)
- Direct re-export `Switch as Toggle` provides no prop bridging

## Proposed Solutions

### Option A: Wrapper component in index.web.tsx (Recommended)
```tsx
export function Toggle({ value, onValueChange, checked, onCheckedChange, disabled, ...rest }) {
  return (
    <Switch
      checked={value ?? checked}
      onCheckedChange={onValueChange ?? onCheckedChange}
      disabled={disabled}
      {...rest}
    />
  );
}
```
**Pros:** Handles both native and shadcn props, drop-in fix.
**Cons:** Must keep in sync if Toggle native API evolves.
**Effort:** Small. **Risk:** Low.

### Option B: Dedicated `toggle.web.tsx` shim file
Same logic but in its own file, imported by the barrel.
**Pros:** Consistent with other shim files.
**Cons:** One more file.
**Effort:** Small. **Risk:** Low.

## Acceptance Criteria
- [ ] Toggle renders correctly on web
- [ ] Toggling state updates correctly (onValueChange fires)
- [ ] `bun check-types` still passes
- [ ] Biome passes

## Work Log
- 2026-05-01: Found during ce:review (architecture-strategist agent)

## Resources
- `packages/ui/nativewindui/index.web.tsx` — current direct re-export
- `apps/expo/app/(app)/weather-alert-preferences.tsx:96–116` — confirmed call site
