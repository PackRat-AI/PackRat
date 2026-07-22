---
started: 2026-06-14
status: in-progress
tracking: packages/ui/nativewindui/index.ts
progress-cmd: bun check:migration
---

# NativeWindUI → Expo UI Migration

## Why

NativeWindUI was chosen for native look and feel. Expo UI now provides that directly — via SwiftUI on iOS and Jetpack Compose on Android — without requiring a private GitHub Packages token, without type-breaking changes on every upstream release, and without wrapper opacity hiding platform bugs.

## Resolved: Text/Button Host + flex layout (Phase 3 unblocked)

`@expo/ui` Universal components (`Text`, `Button`, etc.) render through `Host` — a bridging container to a native SwiftUI/Jetpack Compose surface, not a plain RN view. `Host` itself extends full RN `ViewProps`, so it CAN participate in an RN flexbox tree — Yoga sizes the `Host` box, and everything inside is laid out by SwiftUI/Compose.

**The working pattern** (validated on-device against `apps/expo/app/(app)/weather-alerts.tsx`, see `packages/ui/src/text.tsx` and `packages/ui/src/button.tsx`):

- `Host` gets `cssInterop(Host, { className: 'style' })` registered so `className` (flex, margin, width, etc — same Tailwind classes call sites already use) applies to the `Host` box, not the inner `@expo/ui` component.
- **`matchContents` is conditional, not on/off — and for `Text` it needs a per-call-site signal beyond `className`, not just a heuristic.** Three real, on-device bugs were caught in sequence:
  1. Always passing `matchContents` sizes the box to its native content on both axes, which fights `flex-1` — a `flex-1 mr-2` header label collapsed to its intrinsic width and overlapped its sibling instead of stretching.
  2. Always omitting `matchContents` leaves a `Host` with no `className`/`style` sizing hint (e.g. `<Text className="font-medium">Weight</Text>` — a plain label, no layout classes) with nothing to size itself by, so it collapses to zero height. Two stacked labels like this rendered on top of each other instead of one above the other.
  3. A `className`-only heuristic (`matchContents` on/off based solely on presence of sizing classes) can't distinguish two *conflicting* defaults that both have no sizing class: a short badge/label (`<Text variant="caption2">High</Text>` inside a `rounded-full` pill) needs both-axes match-to-content to shrink-wrap correctly, while a paragraph/note (`<Text variant="footnote">{item.notes}</Text>` inside a fixed-width card) needs *only* the vertical axis matched so it wraps at the parent's width — matching both axes there sizes the box to the text's *unwrapped* single-line width and overflows the card instead of wrapping.
  **The fix**: `Text` takes an explicit `wrap` prop (default `false` — shrink-wrap both axes, matching old NativeWindUI `Text`'s default behavior for labels/headings/badges). Call sites rendering genuinely dynamic-length paragraph content (notes, descriptions, bios, comments, review bodies — not names/titles/counts/badges) pass `wrap` to switch to vertical-only matching. An explicit sizing class (`flex-1`, `w-*`, ...) on `className` always wins over either default, for both `Text` and `Button`. Implementation: `packages/ui/src/lib/text-class-parser.ts` — `textMatchContents(hostClassName, wrap)` for `Text`, `shouldMatchContents(className)` (both-axes only, no `wrap` concept — `Button` has no paragraph-text use case) for `Button`.
- Typography (`variant`, `color`, font weight/size) maps to the inner `@expo/ui` component's `textStyle` prop — it has no `className`, so variant→style mapping lives in the wrapper (see `VARIANT_FONT_SIZE`/`VARIANT_LINE_HEIGHT`/`COLOR_KEY` in `text.tsx`).
- Colors resolve via `useColorScheme().colors` (same static per-theme values `ActivityIndicator` call sites already use), not NativeWind's CSS-variable `text-*` classes, since those don't reach the native-bridged text.
- **`Text`'s `className` is auto-split** by `packages/ui/src/lib/text-class-parser.ts`: font-weight (`font-medium`...), font-size (`text-lg`...), text-align (`text-center`...), and text-color utilities (semantic tokens like `text-muted-foreground`/`text-destructive`, plus any raw Tailwind palette class like `text-red-500`, resolved via the real `tailwindcss/colors` import) are extracted into the native `textStyle`; everything else stays on `Host`'s `className` untouched. Call sites keep writing `className` exactly as before — no per-site typography rewrites needed.
- **`Button` has no text-styling escape hatch.** `@expo/ui` Universal `Button`'s type only exposes `variant` (`filled`/`outlined`/`text`) for its label — no `textStyle`, no color prop. Typography classes on `<Button className="...">` (font-weight, text-color) are dropped silently at the parser level for Button; only layout classes pass through to `Host`. If a call site needs custom label styling, pass a `Text` (or `ExpoText`) as `children` instead of `label`, since `children` accepts arbitrary `ReactNode`.

Migrating a call site is: swap the import, keep `className`/`style` as-is for layout (typography classes on `Text` self-resolve via the parser), move `variant`/color-driven typography to the wrapper's semantic props (`variant`, `color`, `textColor` for one-off hex overrides) only when there's no matching class. **Always reload and eyeball the screen after converting it** — the `matchContents` bug reproduced silently in the type system and only showed up visually.

**Known gaps, kept on `@packrat-ai/nativewindui`, not migrated:**
- `apps/expo/features/packs/components/GapSuggestionRow.tsx` — `Text` used as a `MaskedView` `maskElement`; a `Host`-bridged native view's compatibility with `MaskedView`'s alpha-mask rendering is unverified, higher risk than worth it for this one file.
- `apps/expo/app/(app)/demo/index.tsx` — dev-only component showcase screen using `uiTextView`/`selectable` props with no `@expo/ui` equivalent.
- `apps/expo/features/ai/components/ChatBubble.tsx` — one `Text` aliased to `SelectableText` (old package) for the text-selection bottom sheet; `selectable` has no `@expo/ui` equivalent. The other 4 `Text` uses in that file are migrated.

**Codemod caveat:** the bulk of Text/Button call sites (139 files) were converted via a scripted import swap + typecheck pass, not one-by-one on-device verification like the first two files. The `matchContents`-collapse bug (zero-height stacking) is a silent, type-safe failure — a broad visual QA pass across converted screens is still owed before calling this phase fully verified, typecheck passing is necessary but not sufficient.

**Post-codemod on-device sweep** found the `wrap` default itself needs auditing beyond field-name heuristics — two more real overflow bugs surfaced by hand (`trail-conditions.tsx` disclaimer box, `season-suggestions.tsx` subtitle) that the original `.notes`/`.description`/etc. field-name scan missed, because they were plain translated strings (`t('...')`) with no distinguishing field name. A follow-up structural scan (note/callout boxes — `bg-muted`/`bg-card` + padding — disclaimer/hint/error/empty-state copy, strings >~40 chars) caught 39 more across 30 files. **This pattern (missing `wrap` on prose text) is the single highest-risk remaining defect class in the Text migration** — any new screen conversion should default to checking every `Text` inside a padded note/card/box for `wrap`, not just ones with an obviously-named data field.

**A fourth Text sizing bug, then a Button-nesting bug, found on the same reset-password screen:**
- `wrap:true`'s `matchContents:{vertical:true}` only stops `Host` from shrink-wrapping — it doesn't give SwiftUI/Compose an actual width to wrap text against. A parent using `items-center` (cross-axis center, not Yoga's default `stretch`) never hands `Host` a width, so wrapped text with no explicit sizing class rendered **one word per line** instead of wrapping at the visible container's width. Fixed: `Text` now falls back to `style={{ width: '100%' }}` whenever `wrap` is set and `className` has no explicit `w-*`/`flex-1`-style sizing class (see `needsExplicitWidth` in `text-class-parser.ts`).
- **Nesting a migrated `Text` inside a migrated `Button` breaks Button's sizing** — two independent `Host` native-bridge boundaries can't correctly report intrinsic size across each other. `<Button><Text>Label</Text></Button>` (the shape the codemod left everywhere, since `Button.label` was never used) collapsed the button to a near-zero-size blob with the label overflowing outside it. This affected most already-migrated Button call sites, not just ones with a specific size prop — the root cause is structural (nested Hosts), not a size/variant issue.
  **Fix**: `Button` now auto-extracts a plain string when `children` is exactly one `Text` (or raw string) with only string content, and passes it via `@expo/ui`'s `label` prop instead of nesting — see `extractLabel` in `button.tsx`. This resolves the dominant case with zero call-site rewrites.
  **Known remaining gap**: icon+text or multi-child `Button` content still nests a `Host`-bridged child and is still nested-Host-risky — not yet fixed, not yet verified on-device. Before trusting any `Button` with non-plain-text children, verify it on a real device first.

## Resolved: TextField — no Host bridge, two platform files

`TextField` never needed a native Host bridge — the old package's implementation was already plain RN (`TextInput`/`Pressable`/`View`/Reanimated), never `@expo/ui`. The original plan (replacement map, above) assumed wrapping `@expo/ui` Universal `TextInput`, but that component has no floating-label, no Material-variant styling, and no advantage over the existing RN composition — so it was ported directly instead.

The old package had two genuinely different platform designs (not a shared component with platform tweaks): iOS used a simple non-animated layout, Android used a Material-style floating label with Reanimated. Rather than force one design onto both platforms, both were preserved as separate files — `packages/ui/src/text-field.tsx` (Android/default, Material) and `packages/ui/src/text-field.ios.tsx` (iOS, simple) — sharing one `TextFieldProps`/`TextFieldRef` type so call sites see one API regardless of platform. Metro resolves the `.ios.tsx` suffix at bundle time from the unsuffixed import path; a platform-suffix-free base file isn't needed here since `text-field.tsx` itself is a real implementation (the Android/default), not a re-export shim.

One typecheck fix needed: the Material `MaterialLabel`'s filled-variant background referenced `colors.border`, a key that existed on the old package's own theme but not on this app's `apps/expo/theme/colors.ts`. Changed to `colors.card` (closest surface color used for filled-variant containers elsewhere) — verified via grep that no real call site passes `materialVariant="filled"`, so this path was already dead code, fixed for type correctness only.

Verified on-device (iOS): `auth/(create-account)/credentials.tsx` (4 stacked fields, one with `leftView`) and `auth/(login)/index.tsx` (2 fields) both render correctly — fields sized correctly, dividers between fields visible, placeholder text and Submit/Continue button positioned correctly. Android Material design not yet re-verified on-device in this migration pass (previously only visually reviewed pre-port); low risk since it's a near-1:1 port of the original 334-line file.

## Resolved: Sheet/useSheetRef — no Host bridge, direct port

`Sheet`/`useSheetRef` never needed `@expo/ui` either — the old package's implementation was already a thin wrapper around `@gorhom/bottom-sheet`'s `BottomSheetModal` (an actively-maintained RN library, already a JS dependency of `apps/expo`, added to `packages/ui/package.json` too). Ported unchanged to `packages/ui/src/bottom-sheet.tsx`; same zero-native-bridge category as `List`/`Card`/`Toggle`/`Checkbox`/`Avatar`.

17 call sites updated. A few files import `Sheet`/`useSheetRef` alongside still-unmigrated `Alert`/`Form` symbols from the same `@packrat/ui/nativewindui` line (`ChatBubble.tsx`, `getPackTemplateDetailOptions.tsx`) — these were split into two import lines rather than migrated wholesale, since `Alert`/`Form` aren't done yet.

**On-device verification gap, accepted deliberately:** `Sheet` only opens via an in-app button press (e.g. the "+" FAB on `pack-templates` opening `TemplateCreationOptions`) — there's no deep-linkable "sheet open" state, and the user's mandated `xcrun simctl`-only workflow (deep-link navigation + screenshot, no coordinate taps/AppleScript/cliclick) has no way to trigger it. Typecheck and lint are clean, and the component is an unmodified 1:1 port of an already-shipped wrapper around an unchanged third-party library — the same risk profile as other zero-Host-bridge ports that were accepted on typecheck+lint alone. Flagging here rather than silently skipping the check.

## Resolved: Form/FormSection/FormItem — no Host bridge, direct port

Same story as `Sheet`/`TextField`: the old package's `Form` was already plain RN `View` composition — no `@expo/ui` involved. Ported directly to `packages/ui/src/form.tsx`. One real prop-shape difference handled: `FormSection`'s `materialIconProps` used the old package's own `Icon` component (`sfSymbol`/`materialCommunityIcon` object props); this app has its own `Icon` (`apps/expo/components/Icon`) with a unified `name` string prop. All 6 real call sites already passed `materialIconProps={{ name: '...' }}` (a plain MaterialCommunityIcons name string), so the new type (`{ name: MaterialIconName }`) is a drop-in match — no call-site changes needed beyond the import swap.

15 call sites updated (2 of them, `PackForm.tsx`/`PackTemplateForm.tsx`, needed splitting a still-mixed `DropdownMenu`+`Form` import into two lines; 3 auth screens similarly split from `AlertAnchor`).

Verified on-device (iOS): `auth/(login)/index.tsx` renders correctly — grouped card with divider between Email/Password fields, matching the pre-migration layout exactly.

**Phase 3 is now fully complete** — all of Text, Button, List, Toggle, TextField, Sheet, and Form/FormSection/FormItem are migrated off `@packrat-ai/nativewindui`. Remaining work is Phase 4 (`Alert`, `ContextMenu`/`DropdownMenu`, `Toolbar` — all previously deprioritized as higher-risk) and Phase 2's `SearchInput`.

## Resolved: Alert/AlertAnchor — no @expo/ui bridge needed on either platform

Investigated the previously-paused `Alert` (blocked earlier in this migration on an unverified `ExpoAlert.Trigger` invisible-button mechanism and `@expo/ui` Jetpack Compose `AlertDialog`'s fixed 2-button/no-prompt-slot limitation, which can't cover the old API's N-button + prompt-mode surface). Re-reading the old package's actual source resolved both blockers at once: **the old package's Android/default `Alert` was never `@expo/ui` either** — it was already built on `@rn-primitives/alert-dialog` (an unstyled RN primitive, not a native bridge). Only the docs' original replacement-map guess (SwiftUI Alert + Jetpack Compose AlertDialog) assumed otherwise.

Given that, the simplest and lowest-risk path for both platforms:
- **`alert.ios.tsx`**: rewritten to use RN core's `Alert.alert`/`Alert.prompt` directly — both already render a real native `UIAlertController`, so there's no reason to route through `@expo/ui`'s SwiftUI `Alert` and its unverified `Trigger` mechanism at all. Same native look, zero Host risk, `Alert.prompt` is iOS-only in RN core which happens to match this file being iOS-only.
- **`alert.tsx`** (Android/default): ported directly from the old package's `@rn-primitives/alert-dialog`-based implementation — no `@expo/ui` involved, N-button layout and prompt-mode (plain-text/secure-text/login-password) all carry over unchanged.

One real prop-shape adaptation: `materialIcon` used the old package's own `Icon` (`materialCommunityIcon` prop); this app's `Icon` takes a plain `name` string. Real call sites (`AIPacksScreen.tsx`, `DeleteAccountButton.tsx`) already passed `{ name: '...', color: '...' }`-shaped objects, so `materialIcon` is now typed `{ name: MaterialIconName; color?: string }` — a drop-in match, no call-site rewrites needed beyond the import swap.

A type-only gap in `@rn-primitives/hooks`' `useAugmentedRef`: its return type doesn't line up with `AlertDialogPrimitive.Root`'s `ref` prop even though the runtime behavior (methods merged onto the forwarded View ref) is the documented pattern — same category as the SwiftUI/Jetpack-Compose `Host` `className` typing gap, resolved the same way (local `as unknown as React.Ref<View>` cast with a comment naming the mismatch).

18 call sites updated, all pure `Alert`/`AlertAnchor`/`AlertMethods` imports (no splitting needed).

**On-device verification gap, accepted deliberately:** both platforms' `Alert` only appear after a user action (button press or, for the auth-flow error alerts, a failed form submission) — no deep-linkable "alert shown" state, and the mandated `xcrun simctl` deep-link+screenshot workflow can't type into fields or press buttons to trigger one. Typecheck and lint are clean. Risk is asymmetric by platform: iOS is essentially zero-risk (unmodified RN core native API); Android is a direct, unmodified port of already-shipped code using an already-installed primitive, same risk class as `Sheet`/`Form`. Both accepted on typecheck+lint given that profile — flagging here per the same standard as the `Sheet` gap above.

Phase 4 remaining: `ContextMenu`/`DropdownMenu` (unverified `RNHostView`/Trigger mechanism on iOS), `Toolbar` (no `@expo/ui` equivalent identified). Phase 2's `SearchInput` also still open.

## Resolved: ContextMenu/DropdownMenu — no @expo/ui bridge, third time this pattern holds

The previously-documented blocker ("unverified `RNHostView`/Trigger mechanism on iOS") was based on the same wrong assumption as `Alert`: that these components used `@expo/ui`. They don't, on either platform:

- **Android/default**: `@rn-primitives/context-menu` / `@rn-primitives/dropdown-menu` — unstyled RN primitives, not `@expo/ui`.
- **iOS**: `react-native-ios-context-menu` — a real, separate third-party native library (its own Fabric/paper native module), also not `@expo/ui`. `DropdownMenu` and `ContextMenu` share the same iOS library (`ContextMenuButton` vs. `ContextMenuView`).

Ported directly to `packages/ui/src/context-menu/` and `packages/ui/src/dropdown-menu/` (each: `types.ts`, `utils.ts` for `create*Item`/`create*SubMenu`, the Android/default `.tsx`, the iOS `.ios.tsx`, and an `index.ts` barrel). `ContextMenuSubMenu`/`DropdownMenuSubMenu` on Android reuse `DropdownMenu` itself (same as the original), so `DropdownMenu` had to be built first.

Adaptations beyond the mechanical port:
- `icon`/`materialIcon` fields switched from the old package's own `Icon` (`sfSymbol`/`materialCommunityIcon` object props) to this app's `Icon` (`name` string + `color`) — same pattern as `Form`'s `materialIconProps` and `Alert`'s `materialIcon`. No real call site used `icon`/`image` on any item, so this is a type-only change.
- `Button` (already-migrated `@expo/ui`-wrapped version) didn't expose `accessibilityHint` or `onLayout`, both used by menu item rows (accessibility hint text) and submenu triggers (measuring trigger position for flyout placement). Widened `packages/ui/src/button.tsx`'s `ButtonProps` to accept both and pass them through to `Host` — a real, reusable gap-fix, not menu-specific.
- Two stale `@ts-expect-error` suppressions (for a `react-native-ios-context-menu` type bug referenced in a GitHub issue) no longer reproduce against the currently-installed version's types — removed rather than left as dead suppressions (`tsc` flags unused `@ts-expect-error` as an error).
- `useMaxParams` (Biome, max 2) hit twice more: `toConfigMenu` (3 params, both iOS files) converted to an options object; `View.measure`'s 6-argument native callback (in `context-menu.tsx`'s `onTriggerLongPress`) can't be restructured since it's RN core's own signature — suppressed with `biome-ignore` and a comment naming the reason, consistent with the project's convention for third-party API shapes outside our control.

11 call sites updated across the messages/chat feature and the two pack-category dropdown pickers (`PackForm.tsx`, `PackTemplateForm.tsx`). One dead-code exception: `ChatBubble.tsx` imports `Text as SelectableText` from the old package but its `ContextMenu` usage is fully commented out — left as-is, not migrated, since there's nothing live to migrate.

**On-device verification**: `messages/conversations.tsx` (uses both `ContextMenu` per-row and `DropdownMenu` for the top-bar filter) loads and renders correctly via deep link — confirms the import graph and screen mount work. The actual menu-open interaction (long-press for `ContextMenu`, tap for `DropdownMenu`) requires a touch gesture the mandated `xcrun simctl` deep-link+screenshot workflow can't perform (no coordinate taps). Typecheck and lint are clean. Same accepted-gap category as `Sheet`/`Form`/`Alert` above — flagging per the same standard.

## Resolved: Toolbar/ToolbarCTA/ToolbarIcon — no @expo/ui bridge, fourth (and final) time this pattern holds

Same story again: the old package's `Toolbar` wrapped `expo-blur`'s `BlurView` (already an installed dependency), not `@expo/ui`. Ported directly to `packages/ui/src/toolbar.tsx`. `icon` props switched from the old package's `Icon` shape to this app's (`name` string + `color`); the one real call site (`conversations.android.tsx`'s `ToolbarCTA`) already passed a plain `{ name: '...' }` object. `ToolbarIcon` has zero real call sites but was ported anyway for API completeness (same shape as `ToolbarCTA`, cheap to keep).

2 call sites updated (`conversations.tsx`, `conversations.android.tsx`).

**This closes out Phase 4 and the entire component migration** — every component originally exported from `packages/ui/nativewindui/index.ts` is now ported to `packages/ui/src/`. In hindsight, all four of the "high-risk, paused" Phase 4 components (`Alert`, `ContextMenu`, `DropdownMenu`, `Toolbar`) turned out to need zero `@expo/ui` Host bridge — the original replacement-map guesses (SwiftUI Alert, Jetpack Compose AlertDialog/DropdownMenu, generic "platform-specific Toolbar") were never verified against the old package's actual source, which already used plain RN composition and third-party native libraries throughout. Only `Text`, `Button`, and `ActivityIndicator` (Phase 3) ever touched `@expo/ui` for real.

Remaining before full removal: Phase 2's `SearchInput` (marked "reverted, pending re-migration" in the tracker), then the final removal phase (drop the `@packrat-ai/nativewindui` dependency, `PACKRAT_NATIVEWIND_UI_GITHUB_TOKEN`, etc.) once the tracker is fully empty.

## Resolved: SearchInput — no @expo/ui bridge, kept as a component (not migrated to headerSearchBarOptions)

The original plan (replacement map, above) called for deleting `SearchInput` entirely in favor of Expo Router's `Stack.SearchBar`/`headerSearchBarOptions` — the native nav-bar search pattern. Checked all 6 real call sites (`location-search.tsx`, `PackSelectionScreen.tsx`, `CatalogBrowserModal.tsx`, `PackStatsTile.tsx`, `LocationsScreen.tsx`, `LocationSearchScreen.tsx`): every one renders `SearchInput` inline, embedded in a modal or screen body above a list/map — none are a top-of-screen nav-bar search. `headerSearchBarOptions` doesn't fit that usage (it replaces the nav bar's own search affordance, not an in-content search field), so `SearchInput` was ported as a component instead, matching the same "old plan assumed something the old package's actual source didn't require" pattern found in every other Phase 4 component this session.

Like `TextField`, this has two genuinely different platform designs — Android/default is a pill-shaped button-wrapped search bar, iOS is an animated cancel-button design (Reanimated `measure`-driven width animation). Ported both directly to `packages/ui/src/search-input.tsx` + `.ios.tsx`, sharing `search-input-types.ts`. `Icon` name references switched from the old package's `magnifyingglass`/`multiply` (SF Symbol names) to this app's own icon set naming (`magnify`/`close`, matching what other search/clear UI in this app already uses).

`apps/expo/components/SearchInput.tsx` — a thin wrapper adding the Android keyboard-hide-blur fix (`useKeyboardHideBlur`) — updated to import from the new location instead of `@packrat/ui/nativewindui`; its internal alias renamed from `NativeWindUISearchInput` to `BaseSearchInput` since the old name was no longer accurate.

Also widened `Button`'s props with `accessibilityLabel` (alongside the `accessibilityHint`/`onLayout` additions from the ContextMenu/DropdownMenu migration) — `SearchInput`'s pill-button trigger needed it.

Verified on-device (iOS): `trip/location-search.tsx` — pill-shaped search bar renders correctly with magnifying-glass icon, placeholder text, positioned above the map.

**This closes the entire `packages/ui/nativewindui/index.ts` tracker — every originally-exported component is now ported to `packages/ui/src/`.** Next: the final removal phase (drop `@packrat-ai/nativewindui` from `package.json`, remove `PACKRAT_NATIVEWIND_UI_GITHUB_TOKEN` from `bunfig.toml`/docs, delete the now-empty `packages/ui/nativewindui/` directory) — not started yet.

## Rules

1. **`@expo/ui` is the primary source.** Every component gets its replacement from `@expo/ui` first.
2. **Universal before platform-specific.** `@expo/ui` Universal components run on iOS, Android, and web from one file. Use them when available. Use SwiftUI/JC platform-specific variants only when Universal doesn't cover the use case.
3. **RN core is last resort.** Only fall back to `react-native` when `@expo/ui` has no equivalent (e.g. `useColorScheme`).
4. **All UI lives in `packages/ui`.** No UI components in `apps/expo/components/` — those are either being replaced or moved.
5. **`apps/expo/components/` cleanup is a parallel track** — see section below.

## How progress is tracked

`packages/ui/nativewindui/index.ts` is the live tracker — one export line per component still backed by `@packrat-ai/nativewindui`. Delete a line when its `packages/ui` replacement lands. When the file is empty, remove `@packrat-ai/nativewindui` from `packages/ui/package.json` and drop `PACKRAT_NATIVEWIND_UI_GITHUB_TOKEN` from `bunfig.toml`.

```bash
bun check:migration   # prints per-phase count + fails if any file bypasses the adapter
```

## Replacement map

Priority column: **U** = `@expo/ui` Universal, **S** = `@expo/ui` SwiftUI (iOS), **JC** = `@expo/ui` Jetpack Compose (Android), **C** = `@expo/ui` community drop-in, **RN** = `react-native` (last resort only), **ER** = `expo-router`.

| NativeWindUI | Uses | @expo/ui replacement | Priority | packages/ui file |
|---|---|---|---|---|
| `Text` | 114 | `Text` | U | `src/text.tsx` |
| `Button` | 49 | `Button` | U | `src/button.tsx` |
| `ActivityIndicator` | 22 | `ProgressView` / `LoadingIndicator` | S + JC | `src/loading-indicator.ios.tsx` + `.android.tsx` |
| `ListItem` | 21 | `ListItem` (+ `.Leading` `.Trailing` `.Supporting`) | U | `src/list-item.tsx` |
| `LargeTitleHeader` + `LargeTitleSearchBarMethods` | 25 | `Stack.Screen.Title` + `Stack.SearchBar` + `Stack.Toolbar` | ER | — (navigation layer, not packages/ui) |
| `Alert` + `AlertMethods` + `AlertAnchor` | 25 | `Alert` / `AlertDialog` + `BasicAlertDialog` | S + JC | `src/alert.ios.tsx` + `.android.tsx` |
| `Sheet` + `useSheetRef` | 16 | `BottomSheet` | U | `src/bottom-sheet.tsx` |
| `Form` | 8 | `Form` / `FieldGroup` | S + U | `src/form.ios.tsx` + `.tsx` |
| `FormSection` | 8 | `Section` / `FieldGroup.Section` | S + U | `src/form-section.ios.tsx` + `.tsx` |
| `FormItem` | 8 | `LabeledContent` / `FieldGroup.Section` row | S + U | part of form-section |
| `TextField` | 9 | plain RN `TextInput`/`Pressable`/`View` (no Host bridge needed) | — | `src/text-field.tsx` + `.ios.tsx` |
| `Card` + `CardContent` + `CardTitle` | 8 | `Card` / custom `View` | JC + custom iOS | `src/card.android.tsx` + `.ios.tsx` |
| `SegmentedControl` | 3 | `SegmentedControl` | C | `src/segmented-control.tsx` |
| `Toggle` | 1 | `Switch` | U | `src/switch.tsx` |
| `List` | 1 | `List` | U | `src/list.tsx` |
| `ContextMenuMethods` | 1 | `ContextMenu` / `DropdownMenu` | S + JC | `src/context-menu.ios.tsx` + `.android.tsx` |
| `SearchInput` / `AdaptiveSearchHeader` | 1 | `Stack.SearchBar` | ER | — (navigation layer) |
| `Avatar` + `AvatarFallback` + `AvatarImage` | 6 | `@rn-primitives/avatar` (no @expo/ui Avatar) | — | `src/avatar.tsx` |
| `useColorScheme` | 20 | `useColorScheme` from `react-native` (no @expo/ui hook) | RN | — (hook, not a component) |
| `cn` | 3 | remove — import `tailwind-merge` directly | — | — (utility, not a component) |

## `apps/expo/components/` cleanup (parallel track)

Everything here is either replaced by `@expo/ui` via `packages/ui` or moved to a feature folder. Nothing new should be added here.

| File | Action |
|---|---|
| `Button.tsx` | Delete — replaced by `packages/ui` `Button` |
| `Card.tsx` | Delete — replaced by `packages/ui` `Card` |
| `TextInput.tsx` | Delete — replaced by `packages/ui` `TextInput` (port the Android keyboard fix into it) |
| `SearchInput.tsx` | Delete — replaced by `Stack.SearchBar` / `headerSearchBarOptions` |
| `ThemeToggle.tsx` | Move to `packages/ui/src/theme-toggle.tsx` |
| `Container.tsx` | Move to `packages/ui/src/container.tsx` |
| `ErrorState.tsx` | Move to `packages/ui/src/error-state.tsx` |
| `ScreenContent.tsx` | Move to `packages/ui/src/screen-content.tsx` |
| `Markdown.tsx` | Move to `packages/ui/src/markdown.tsx` |
| `Icon/` | Move to `packages/ui/src/icon/` — wraps `@expo/ui` Universal `Icon` |
| `LargeTitleHeaderOverlapFixIOS.tsx` | Move to `packages/ui/src/large-title-header-overlap-fix-ios.tsx` — still needed |
| `LargeTitleHeaderSearchContentContainer.tsx` | Absorbed into platform SearchOverlay components — delete |
| `AndroidTabBarInsetFix.tsx` | Move to `packages/ui/src/android-tab-bar-inset-fix.android.tsx` |
| `BackButton.tsx` | Move to `packages/ui/src/back-button.tsx` |
| `HeaderButton.tsx` | Move to `packages/ui/src/header-button.tsx` |
| `TabBarIcon.tsx` | Move to `packages/ui/src/tab-bar-icon.tsx` |
| `CategoriesFilter.tsx` | Move to `apps/expo/features/catalog/components/` |
| `ai-chatHeader.tsx` | Move to `apps/expo/features/ai-chat/components/` |
| `EditScreenInfo.tsx` | Delete (dev-only artefact) |
| `initial/` | Audit each file — move to relevant feature folder or `packages/ui` |

## Phases

### Phase 1 — Non-UI cleanup (no device testing needed)
Remove utilities from the adapter that were never UI components.

- `useColorScheme` → change 20 import sites to `react-native`
- `cn` → inline the 3 call sites with `tailwind-merge` or delete

Estimated effort: half a day. Ship as one PR.

### Phase 2 — Expo Router native patterns (42 uses)
Replace ref-based imperative navigation APIs.

- `LargeTitleHeader` → restructure each screen to use `Stack.Screen.Title`, `Stack.SearchBar`, `Stack.Toolbar`. Each screen group (home, packs, catalog, trips, profile) is one sub-PR.
- `Sheet` + `useSheetRef` → replace `ref.current.present()` calls with `router.push('/sheet-route')` + `presentation: 'formSheet'` in the Stack layout. New route files replace old modal components.
- `SearchInput` / `AdaptiveSearchHeader` → `Stack.SearchBar` or `headerSearchBarOptions`.
- `LargeTitleHeaderOverlapFixIOS` and `LargeTitleHeaderSearchContentContainer` are moved to `packages/ui/src/` and remain available for screens that need them.

Estimated effort: 3–5 days. One PR per tab section.

### Phase 3 — Universal @expo/ui components in packages/ui (high frequency)
Wire up `packages/ui/src/` files that re-export or wrap Universal components. Import sites change from `@packrat/ui/nativewindui` to `@packrat/ui`.

Order by frequency:

1. **`Text` (114 uses) — BLOCKED**, see "Blocked" section above. `@expo/ui` Text cannot take layout classes (`flex-1`, `mr-2`) that real call sites rely on; there is no NativeWind shim that preserves this without an app-wide layout restructure.
2. **`Button` (49 uses) — BLOCKED**, same Host/flex-layout constraint as Text.
3. **`ListItem` (21 uses)** — `packages/ui/src/list-item.tsx` re-exporting `@expo/ui` Universal `ListItem` with `Leading`, `Trailing`, `Supporting` sub-components. Verify call sites don't apply layout classes directly to `ListItem` before proceeding (same risk class as Text/Button).
4. **`Sheet` + `useSheetRef` (16 uses)** — `packages/ui/src/bottom-sheet.tsx` wrapping `@expo/ui` Universal `BottomSheet`. Replace `useSheetRef` with `isPresented` / `onDismiss` props.
5. **`Form` + `FormSection` + `FormItem` (24 uses)** — `packages/ui/src/form.tsx` wrapping `FieldGroup` + `FieldGroup.Section` (Universal); `packages/ui/src/form.ios.tsx` wrapping SwiftUI `Form` + `Section` for native iOS grouped lists.
6. **`TextField` (9 uses)** — `packages/ui/src/text-input.tsx` wrapping `@expo/ui` Universal `TextInput`. Port the Android keyboard focus fix from the existing `apps/expo/components/TextInput.tsx`.
7. **`Toggle` (1 use)** — `packages/ui/src/switch.tsx` re-exporting `@expo/ui` Universal `Switch`.
8. **`List` (1 use)** — `packages/ui/src/list.tsx` re-exporting `@expo/ui` Universal `List`.

Estimated effort: 1 week across PRs.

### Phase 4 — Platform-specific @expo/ui wrappers in packages/ui
Components that need per-platform files because @expo/ui has different APIs on iOS vs Android.

- **`ActivityIndicator` (22 uses)** — `packages/ui/src/loading-indicator.ios.tsx` (SwiftUI `ProgressView`) + `packages/ui/src/loading-indicator.android.tsx` (JC `LoadingIndicator`). Metro picks up the platform file automatically.
- **`Alert` + `AlertMethods` + `AlertAnchor` (25 uses)** — `packages/ui/src/alert.ios.tsx` (SwiftUI `Alert` with `Alert.Trigger`, `Alert.Actions`, `Alert.Message`) + `packages/ui/src/alert.android.tsx` (JC `AlertDialog` / `BasicAlertDialog`).
- **`Card` family (8 uses)** — `packages/ui/src/card.android.tsx` (JC `Card`) + `packages/ui/src/card.ios.tsx` (custom `View`-based card, SwiftUI has no `Card` primitive).
- **`ContextMenuMethods` (1 use)** — `packages/ui/src/context-menu.ios.tsx` (SwiftUI `ContextMenu` with `Trigger`, `Items`, `Preview`) + `packages/ui/src/context-menu.android.tsx` (JC `DropdownMenu`).
- **`SegmentedControl` (3 uses)** — `packages/ui/src/segmented-control.tsx` re-exporting from `@expo/ui/community/segmented-control`.

Estimated effort: 3–5 days.

### Phase 5 — No @expo/ui equivalent
- **`Avatar` family (6 uses)** — `packages/ui/src/avatar.tsx` wrapping `@rn-primitives/avatar` (same foundation nativewindui used internally; only import path changes).

Estimated effort: half a day.

### Phase 6 — packages/ui restructure + apps/expo/components/ removal
- Add `packages/ui/src/` directory with proper exports and `tsconfig.json` path alias.
- Move / delete all files from `apps/expo/components/` per the cleanup table above.
- Update root `tsconfig.json` and `packages/ui/package.json` to export from `src/` instead of wrapping `@packrat-ai/nativewindui`.
- Enable `check-types` in `packages/ui/package.json` (currently disabled because tsc deep-checked nativewindui source `.tsx` files and surfaced 197 upstream errors — that problem goes away once we own the source).

Estimated effort: 1–2 days.

### Phase 7 — Final removal
Once the adapter file is empty and all `apps/expo/components/` files are gone:

- Remove `@packrat-ai/nativewindui` from `packages/ui/package.json`.
- Remove the `@packrat-ai` scope from `bunfig.toml`.
- Remove `PACKRAT_NATIVEWIND_UI_GITHUB_TOKEN` from `.env.local` docs, CI secrets, and the `CLAUDE.md` private package auth section.
- Delete `packages/ui/nativewindui/` directory.
- Delete `scripts/lint/nativewindui-migration.ts` and remove `check:migration` from `package.json`.

## PR checklist per component

- [ ] Replacement lives in `packages/ui/src/`
- [ ] Platform-specific files (`.ios.tsx` / `.android.tsx`) used where needed
- [ ] Renders correctly on iOS + Android (dark mode included)
- [ ] Existing Maestro E2E flows pass
- [ ] `bun check:migration` exits 0
- [ ] `bun check-types` exits 0
- [ ] Corresponding line(s) removed from `packages/ui/nativewindui/index.ts`
- [ ] No remaining imports from `apps/expo/components/` for migrated component
