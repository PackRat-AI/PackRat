---
status: pending
priority: p3
issue_id: "016"
tags: [code-review, security, quality, web-shims]
dependencies: []
---

# Picker collectItems Needs child.type === PickerItem Guard

## Problem Statement

`collectItems` in `picker.web.tsx` checks only that `child.props.label` is a string before casting `child.props as PickerItemProps`. Any non-PickerItem component that happens to have a `label` string prop will be silently promoted into the select list. The existing `apps/expo/lib/Picker.web.tsx` already uses the correct pattern: `React.isValidElement<ItemProps>(child) && child.type === PickerItem`.

Also: `value` is not validated — a child with `label` but no `value` produces `value={String(undefined)}` = `"undefined"` as a SelectItem key/value.

## Findings

- Security reviewer (M1), simplicity reviewer, and TypeScript reviewer all flagged
- The existing web-ui Picker shim at `apps/expo/lib/Picker.web.tsx` already has the correct pattern

## Proposed Solutions

### Option A: Add React.isValidElement + type check (Recommended)
```ts
function collectItems(children: React.ReactNode): PickerItemProps[] {
  const items: PickerItemProps[] = [];
  React.Children.forEach(children, (child) => {
    if (React.isValidElement<PickerItemProps>(child) && child.type === PickerItem) {
      items.push(child.props);
    }
  });
  return items;
}
```
**Effort:** Small. **Risk:** None.

### Option B: Accept items array prop
See todo 011 discussion. Eliminates traversal entirely.
**Effort:** Medium. **Risk:** Requires caller changes.

## Acceptance Criteria
- [ ] Only actual `<PickerItem>` children are collected
- [ ] Non-PickerItem elements with `label` props are ignored
- [ ] `value` fallback handled (empty string or skip)

## Work Log
- 2026-05-01: Found during ce:review

## Resources
- `packages/ui/nativewindui/picker.web.tsx`
- `apps/expo/lib/Picker.web.tsx` — reference implementation
