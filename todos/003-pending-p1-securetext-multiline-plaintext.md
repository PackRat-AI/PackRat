---
status: pending
priority: p1
issue_id: "003"
tags: [code-review, security, web-shims]
dependencies: []
---

# secureTextEntry + multiline Silently Renders Passwords as Plaintext

## Problem Statement

In `text-field.web.tsx`, when `multiline={true}` a `<textarea>` is rendered. The `secureTextEntry` prop (→ `type="password"`) is only applied to the `<input>` branch. A `<textarea>` has no `type="password"` equivalent. If any call site passes both `multiline={true}` and `secureTextEntry={true}`, the password renders in plaintext — no masking, browsers may offer to save/autocomplete it as a text field, and the value is visible in the DOM.

In React Native, `secureTextEntry` on a multiline TextInput is documented as unsupported. The web shim should be equally explicit.

## Findings

- Security reviewer (M2 finding) confirmed this combination is silently ignored
- `text-field.web.tsx:104–117`: multiline branch renders `<textarea>`, ignores `secureTextEntry`
- No current call sites pass both (so not currently exploitable), but it's a footgun for future code

## Proposed Solutions

### Option A: Dev warning + force non-multiline (Recommended)
```tsx
if (secureTextEntry && multiline) {
  if (__DEV__) console.warn('TextField: secureTextEntry is not supported with multiline on web. Rendering as single-line input.');
  // Fall through to input branch
}
```
**Pros:** Matches RN documented behavior. Warns developers immediately.
**Effort:** Small. **Risk:** None.

### Option B: Runtime assertion
Throw in dev mode if both are set.
**Cons:** More disruptive.

## Acceptance Criteria
- [ ] Passing both `multiline` and `secureTextEntry` does not render a plaintext password field
- [ ] A DEV-mode warning appears when both props are combined
- [ ] Single-line password inputs still work correctly

## Work Log
- 2026-05-01: Found during ce:review (security-sentinel agent)

## Resources
- `packages/ui/nativewindui/text-field.web.tsx:104–117`
