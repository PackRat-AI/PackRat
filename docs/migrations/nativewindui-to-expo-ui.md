---
started: 2026-06-14
status: validated-ios-android-2026-08-03
tracking: packages/ui/nativewindui/index.ts
progress-cmd: bun check:migration
---

# NativeWindUI → Expo UI Migration

## Why

NativeWindUI was chosen for native look and feel. Expo UI now provides that directly — via SwiftUI on iOS and Jetpack Compose on Android — without requiring a private GitHub Packages token, without type-breaking changes on every upstream release, and without wrapper opacity hiding platform bugs.

## Resolved: Text/Button Host + flex layout (Phase 3 unblocked)

> **Superseded** — see "Android A/B validation against the pre-migration build" below. Neither
> `Text` nor `Button` renders through `Host` any more, so the `matchContents`/`wrap` machinery
> described here no longer exists. Kept for the history of why it was tried.

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

**Permanent, justified exception — `selectable`/`uiTextView` text has no `@expo/ui` equivalent on any platform** (confirmed against `@expo/ui`'s Universal, SwiftUI, and Jetpack Compose `Text` types — none expose a selection-mode prop). Two call sites narrowed to the minimum:
- `apps/expo/app/(app)/demo/index.tsx` — only the one `SelectableTextExample` component (dev-only showcase screen) still imports `Text as SelectableText` from `@packrat-ai/nativewindui`; every other `Text`/`Button` on the screen migrated. One incidental fix along the way: the old inline `<Text onPress={...}>NativeWindUI</Text>` hyperlink pattern doesn't work with the migrated `Text` (`@expo/ui`'s Universal Text has no `onPress` and `children` is `string`-only, not `ReactNode`, so nested inline links aren't representable) — replaced with a `Pressable`-wrapped `Text` on its own line instead of true inline text.
- `apps/expo/features/ai/components/ChatBubble.tsx` — one `Text` aliased `SelectableText` for the text-selection bottom sheet; the other 4 `Text` uses in that file are migrated.

This is why `@packrat-ai/nativewindui` cannot be fully removed from `package.json` — dropping it would mean dropping the text-selection feature entirely (long-press-to-copy on AI chat messages, and the demo screen's example of the same). Both remaining imports are for exactly this one feature; nothing else in the app still depends on the old package.

## Resolved: full removal — `@packrat-ai/nativewindui` dropped entirely

The `selectable`/`uiTextView` gap above turned out not to require keeping the old package at all: its `Text` component's `selectable` support was itself just a thin wrapper around `react-native-uitextview`, a standalone third-party native module — already a **direct** dependency of `apps/expo` (`"react-native-uitextview": "^1.1.4"` in `package.json`, not merely transitive), not something the old package owned or built.

Wrapped it directly as `packages/ui/src/selectable-text.tsx` (`SelectableText`, registered with `cssInterop` for `className` support, same pattern as every other plain-RN wrapper this migration produced). Kept intentionally minimal — real call sites (`ChatBubble.tsx`'s copy-selection sheet, `demo/index.tsx`'s one example) pass no `variant`/`color`, just plain `selectable`/`uiTextView` booleans with string children, so this doesn't replicate `Text`'s full variant system.

With that, `@packrat-ai/nativewindui` had zero remaining call sites and was removed everywhere:
- `apps/expo/package.json` — direct dependency deleted
- `package.json` (root) — `overrides` version pin deleted
- `bunfig.toml` — `@packrat-ai` GitHub Packages scope registration deleted (no other package under this scope is used)
- `.github/scripts/configure-deps.ts` — deleted; its `preinstall` hook (`bun run configure:deps`) and the `configure:deps` script entry removed from root `package.json`, since the token-gating it existed for is no longer needed
- `CLAUDE.md` — "Private Package Auth" section removed, the `packages/ui` architecture-table row updated, the "401 on bun install" and "Type errors after NativeWindUI update" Common Issues entries removed
- `packages/ui/nativewindui/index.ts` — rewritten as a completed-migration changelog (kept for historical reference of what mapped to what, rather than deleted outright, since it documents real architectural decisions — e.g. why `Sheet` isn't `@expo/ui` — that would otherwise be lost)

Verified: `bun install` succeeds without `PACKRAT_NATIVEWIND_UI_GITHUB_TOKEN` set at all (previously a hard requirement — install would 401 without it). Full `apps/expo` typecheck and repo-wide lint both clean. On-device (iOS): `demo/index.tsx` loads and renders correctly post-removal (confirms the import graph and `react-native-uitextview`'s existing native linking survived the dependency removal without a rebuild) — the specific `SelectableTextExample` list item is below the fold in a virtualized `FlashList` and the mandated `simctl` workflow can't scroll to bring it into view, so its exact rendering (versus just "doesn't crash on mount") is the one remaining unverified detail across this whole migration.

**The migration is now complete.** `@packrat-ai/nativewindui` is fully removed from the dependency graph.

**`GapSuggestionRow.tsx` migrated, with a residual verification gap flagged below.** Only 2 of its 12 `Text` uses are inside `MaskedView` (`ShimmerFindingText`'s shimmer effect) — the other 10 typography-only `style={{...}}` props were converted to `textStyle` (one `minWidth` split out to `style` since it's layout, not typography). One real behavior change: `@expo/ui`'s Universal `TextStyle` has no `fontStyle`/italic support, so the shimmer text's italic styling was dropped (cosmetic only). `MaskedView`-as-`maskElement` compatibility with a `Host`-bridged `Text` is architecturally reasoned to work — `MaskedView` masks at the native-view/`CALayer` level (iOS) or RenderNode level (Android), which doesn't care what's inside the view being masked, only that it renders — but this could not be verified on-device in this session: reaching `GapSuggestionRow` requires a real pack with items, an authenticated gap-analysis API call, and a button press, none reachable via the mandated `xcrun simctl` deep-link+screenshot workflow. **Flag this specifically for a manual on-device check before considering the migration fully closed** — if the shimmer text renders as a blank/solid box instead of clipped-to-glyph-shape gradient text, revert this one file's two masked `Text` elements to `@packrat/ui/nativewindui`.

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

## Android A/B validation against the pre-migration build (2026-08-02)

The whole migration was finally diffed screen-by-screen against a real pre-migration build on a
physical Android device (TECNO KL4). This was possible without rebuilding anything: the installed
production APK `com.packratai.mobile` v2.1.0 (tag `a1b43629c`) still ships
`@packrat-ai/nativewindui@2.2.1` and no `@expo/ui`, and none of the migration commits are
ancestors of `main` — so it is a genuine baseline. The migrated side ran in the dev client off
Metro. Two package ids, so both stay installed and you alternate between them.

**Run Metro on a dedicated port** (`bun start --dev-client --port 8099` + `adb reverse tcp:8099
tcp:8099`). The dev launcher discovers every Metro on the LAN and will happily attach to another
agent's server on 8081; its NSD discovery also crashed outright with a `NoSuchElementException`
when two were visible.

Everything below was reproduced on-device, not inferred.

### Root cause behind most of it: `Host` has no RN-side intrinsic size

`@expo/ui`'s `Text`/`Button` render through `Host`, a bridge to a native SwiftUI/Compose surface.
Any axis `Host` does not `matchContents` is sized purely by Yoga, and Yoga sees no content — so it
collapses to zero. Normal RN text does `min(contentWidth, parentWidth)`; `Host` can only do
"shrink to content" (may overflow the parent) or "stretch to parent" (needs a stretch context).
**That one limitation produced the majority of the defects found**, and no single default fixes it
because a component cannot know its parent's flex direction.

### Fixed

- **`apps/expo/tailwind.config.js` never included `packages/ui/src`.** It still listed the deleted
  `@packrat-ai/nativewindui` path. NativeWind is content-glob driven, so ~76 classes used *only*
  in `packages/ui/src` compiled to nothing: invisible Android `ListItem` separators, zero-size
  checkboxes, `Form` sections with no spacing, and an alert dialog with no width constraint
  (it rendered full-bleed). One-line fix, very wide blast radius. `screens/**` and
  `features/**/utils` were also uncovered.
- **`Button` is now a plain RN `Pressable`, not `@expo/ui`'s Button.** Three independent
  on-device failures forced this, all from the `Host` limitation above: full-width CTAs
  shrink-wrapped to their label; switching to vertical-only matching then collapsed buttons inside
  a `flex-row` (the alert's "Got it" rendered one character per line); and on Android `@expo/ui`
  hands `children` straight to a Compose composable, where the hosted RN view swallows the touch
  so `onClick` never fires — **every `DropdownMenu` trigger was dead**, verified by instrumenting
  `onPress` and seeing it never run. A `Pressable` has an intrinsic size and keeps touches, refs
  and layout in the RN tree. This matches what the rest of this package already concluded.
  Tradeoff: filled buttons no longer use native Material/SwiftUI button styling — they use the
  app's brand tokens, which is what the pre-migration build looked like.
- **`Button` now forwards `ref` and rest props.** `@rn-primitives` menu/dialog primitives inject a
  ref through `Slot` and call `.measure()` on it to place their portal; dropping it left
  `triggerPosition` null so `Portal` returned null. Also restores `role`/`accessibilityState`/
  `nativeID`, which were being dropped on every menu row and alert title.
- **`Text` no longer deletes nested inline elements.** `flattenToString` mapped every element
  child to `''`, silently removing the Terms/Privacy link text on the consent screen, the address
  on the OTP screen and the timestamp on chat read-receipts. It now recurses, and warns in dev
  when it flattens something with an `onPress`/`href` (whose tap handler cannot survive —
  `@expo/ui` `Text.children` is `string`-only, so a tappable inline segment must be hoisted out).
- **`text-center` is no longer a no-op.** Aligning text inside a box shrink-wrapped to that same
  text does nothing, so centered headings rendered flush-left (127 sites). A text-align class now
  implies vertical-only matching plus a width, same as `wrap`.
- **~214 silently-dropped typography classes now apply.** The parser routed anything it didn't
  recognise onto `Host`'s `className`, where it can never reach native text. Added: `text-white`/
  `text-black`, variant prefixes (`dark:`, `ios:`, `android:` — applied unconditionally, which
  beats not at all), `tracking-*`/`leading-*` (both are supported by `UniversalTextStyle`),
  arbitrary values (`text-[15px]`, `leading-[14px]`), opacity modifiers (`text-foreground/70`),
  and `text-5xl`–`text-9xl`. Variant-prefixed *sizing* (`android:h-14`) is now detected too.
- **`Text` derives `wrap` from `numberOfLines`.** `numberOfLines={2}` could never be reached
  because the box was sized to the unwrapped single-line width. `list.tsx`/`card.tsx` already
  encoded this locally; it now lives in `text.tsx`.
- **`wrap` added to 40 prose call sites** (found by resolving each `t()` key against `en.json` and
  filtering on string length, so short labels that should shrink-wrap were left alone). The
  Settings "Wind & Distance" subtitle overlapping its SegmentedControl was one of these.
- **Alert title/message now wrap**, and `tonal` is a distinct filled-muted Button variant again
  rather than being folded into `outlined`.

### `Text` is a plain RN `Text` too — `@expo/ui` is no longer used for either primitive

Fixing `Button` removed one symptom; `Text` had the same root cause and was converted for the
same reasons. That structurally eliminated the rest of the class rather than patching call sites:

- `min(content, parent)` sizing is what real text does, so **`wrap` is no longer needed anywhere**
  (the prop is kept, deprecated and inert, so the ~40 call sites still compile) and `text-center`
  works without a width hack.
- Nested children compose natively, so the **consent screen's Terms/Privacy links render and are
  tappable again** (verified on-device) instead of being deleted by the string-flattening.
- `numberOfLines` works natively.
- NativeWind applies `className` directly, so `dark:` variants, opacity modifiers and arbitrary
  values all work — the bespoke class parser is now only consulted to see *which* properties a
  className already sets, so `variant`/`color` defaults only fill gaps rather than override.
- The first Dashboard row no longer renders clipped under the large-title header: that was
  `Host`'s async native measure reporting the wrong content height, and it went away with `Host`.

One new bug this surfaced and fixed: a variant's `lineHeight` must not be kept when `className`
overrides the font size (`text-3xl` on a default `body` left a 24px line box around 30px glyphs
and clipped them top and bottom — seen on the iOS auth headline).

**Only `ActivityIndicator` and `SegmentedControl` still touch `@expo/ui`.** In hindsight the
`Host` bridge was never a good fit for primitives that have to participate in a flexbox layout.

### Validated on-device

Android (TECNO KL4) and iOS (iPhone 17 sim), both against the pre-migration baseline where one
exists: auth screen, Dashboard, Profile, Settings (light + dark), Pack form, Create Trip, AI chat,
conversations list, the category `DropdownMenu` (opens, all 9 items, selection applies), the
Android `Alert` (inset card, wrapped message, horizontal buttons), the iOS native `Alert` via the
now-working `show()`, the `Sheet` (AI Mode bottom sheet — previously never validated on any
platform), and the consent screen's inline links.

### Known remaining gaps

- **`SearchInput`'s Android pill and `GapSuggestionRow`'s `MaskedView` shimmer are still
  unvalidated.** Every reachable call site is behind authentication, a pack with items, or a
  Google Maps view that crashes in this dev build (see below).
- **`ContextMenu` has no reachable Android call site** — every consumer wraps it in a
  `Platform.OS !== 'ios'` bypass, so `context-menu.tsx` (the `@rn-primitives` Android
  implementation) never actually runs. Either delete it or give it a real consumer.
- The dev build crashes with `IllegalStateException: API key not found` on any screen containing
  a Google Map (Trips → Add Location). The JS env var is set; the native key in the installed APK
  is not. Environment issue, not a migration one, but it blocks validating map-backed screens.
- `alert.ios.tsx` still drops each button's `testID` (RN core's `Alert` has no such option, so
  Maestro cannot target alert buttons on iOS) and degrades `login-password` prompts to a single
  plain-text field.
- Unrelated but blocking a clean checkout: `react-native-purchases`/`-ui` are declared `"*"` in
  `apps/expo/package.json` but were not installed, so Metro could not bundle until `bun install`.

## Second Android A/B pass (2026-08-03)

A second screen-by-screen pass over the same rig, this time reading the **accessibility tree's
rects** alongside the screenshots rather than judging by eye. That is what caught the items below:
all three had survived the first pass because they look plausible in a screenshot.

Screens diffed: Dashboard, Packs list, pack card, Pack detail, Trips, Catalog, Profile, Settings,
Weight Analysis, Pack Categories, Pack Stats, PackRat AI chat, Search (+ results), Create Pack.

### Fixed in this pass

- **`Button`'s `size` prop did nothing at all** — the single highest-impact defect found in either
  pass, affecting 97 `size=` call sites plus the default `md` on every other button. Sizes were an
  inline `style={({ pressed }) => [SIZE_STYLE[size], ...]}`, but NativeWind's `cssInterop` owns the
  `style` prop on a `className`'d component and drops the **function form** Pressable needs, so the
  whole array was silently discarded. Measured on-device (2x density): `size="icon"` buttons
  rendered at the glyph's intrinsic ~20dp instead of 40dp, and content-sized `md` buttons had *no*
  horizontal padding — "Add Item" on the pack detail screen was 142px wide around a 138px label, so
  the rounded border cut into the glyphs. Now expressed as classes (`SIZE_CLASS`), which go through
  the same pipeline as the variants; `cn` is `twMerge` so call sites still override.
- **Press feedback never rendered**, on `Button` and `ListItem` both — it rode on the same dropped
  style array. Now `active:opacity-70`.
- **`SegmentedControl` painted from the platform palette.** It is one of the two components still
  backed by `@expo/ui`, and no call site passed `tintColor`, so on Android it picked up Material
  You's dynamic colour — a *brown* selected segment on the Settings unit switches, in an app whose
  accent is blue everywhere else on that same screen. Now defaults to the theme's primary.

### Verified equivalent, deliberately not changed

- The pack card's `⋯` overflow menu sat 20px right and 19px up from baseline. This was a *symptom*
  of the size bug, not a separate quirk: once `size="icon"` produced a real 40x40dp box, the glyph
  landed at (616, 744) — the exact pixel the pre-migration build renders it at. Worth noting as a
  reminder that small positional offsets are usually downstream of something structural.
- `md` buttons are ~15dp horizontal / 9dp vertical padding vs the baseline's ~21dp / 9dp, so
  content-sized buttons are a little tighter and 4dp shorter (the height delta comes from the
  `body` variant's explicit `lineHeight: 24` vs the platform's natural 28dp, not from padding).
  Legible, unclipped, correctly centred — left alone rather than pixel-matched.
- Pack detail's action row *diverges in the migrated build's favour*: `className="flex-1"` on
  "Ask AI" is honoured now, so the row fills the width and `⋯` sits at the right edge. The
  pre-migration build left the buttons bunched left with dead space.
- Android `SearchInput` renders identically to baseline (no pill/border in either) — this was
  listed as unvalidated after the first pass.
- The `Camping` filter chip clips at the right edge in **both** builds; it is a horizontal
  scroller, not a regression.

### Invisible text: a foreign-platform class suppressing `Text`'s own colour

Found by the user, not by either sweep. `<Text className="ios:text-foreground">` — the "Continue
with Google" label on the auth screen — rendered black-on-black in dark mode on Android.

The parser resolved `ios:text-foreground` unconditionally, so `Text` believed `className` already
set a colour and skipped its own themed default; NativeWind then correctly declined to apply an
`ios:` class on Android; nothing set a colour and RN fell back to black. The unconditional
resolution was *right* while `Text` rendered through `Host` (className never reached the native
text, so applying a prefixed class anyway beat dropping it). Once `Text` became a plain RN `Text`
and the parser was demoted to detecting *which* properties `className` sets, the trade-off
inverted: over-reporting now suppresses a correct default. Fixed by skipping tokens whose platform
variant does not match `Platform.OS`. `ListSectionHeader` (`ios:text-muted-foreground`, no base
colour) had the identical shape and is fixed by the same change.

**Measure invisible text with standard deviation over the node's rect, not min..max range.** The
label measured sd 0.0 against ~43 for a real rendering — but its *range* was the full 0..255,
because one border pixel falls inside the rect. Checking `maxima` is what made an earlier pass
wrongly conclude the label rendered fine. A short label in a wide box still clears sd 3.0.

### Two traps worth knowing before repeating this

- **Metro dies on every source edit here** (`react-native-css-interop` → Metro's
  `DependencyGraph._onHasteChange`, `TypeError: ... reading 'addedFiles'` under Node 25). Fast
  Refresh never lands and the next capture silently shows the *old* bundle. Restart Metro and
  reload after each edit, and re-measure before concluding a fix did nothing.
- **`screencap` races the renderer.** Screenshots taken right after navigation often show the
  previous screen while `uiautomator dump` already shows the new one. When they disagree, trust the
  dump. Blind tap-chains without verifying state produced several captures of the device home
  screen before this was caught.

## First side-by-side Android comparison in the test rig (2026-08-04)

Previously the `nativewindui/apps/test-app` rig had only ever run on the iOS simulator: there was no
`android/` project and the dev client had never been installed, so no Android old-vs-new comparison
had actually rendered. Now it does — `Toggle` verified as the first component through it.

### `Toggle` on Android: renders and behaves correctly

Material 3 `Switch` via `@expo/ui/jetpack-compose`, side by side with the nativewindui original at
identical props. Checked state is blue (`rgb(0, 112, 233)`, the theme's Android `primary`, so the
app's accent survives instead of Material You's dynamic palette); unchecked is grey track with the
thumb correctly shrunk and moved left. Tapping the new one flipped only its own label ON→OFF and
left the old column untouched, so `onCheckedChange` fires and state is independent. This is direct
evidence for the leaf-control thesis: `ComposeClick` works fine for a self-contained native control
with no RN children — the failures documented above are specific to containers wrapping RN children.

The M3 switch is visibly **larger** than RN's (104x96px box vs 94x54px, thumb noticeably bigger).
That is correct M3 sizing, not a defect, but it does mean rows containing a toggle get slightly
taller — worth watching on dense settings screens rather than assuming a drop-in swap.

### Accessibility semantics require `testID` — passing it is mandatory, not optional

A migrated leaf control that is given **no** `testID` renders as a bare
`androidx.compose.ui.platform.ComposeView` with `checkable=false clickable=false` and **no child
node at all** — invisible to both E2E and TalkBack. It is easy to mistake this for an `@expo/ui`
limitation. It isn't; it's a missing prop.

Pass `testID` and the control emits a real node with correct semantics. Verified on-device with
`packages/ui`'s own `Toggle`:

```
resource-id="new_toggle"  class="android.view.View"
checkable="true"  checked="true"  clickable="true"  focusable="true"
```

`checked` tracks state (flipping the control gives `checked="false"` alongside the `OFF` label), so
it is both a usable E2E selector and correct accessibility semantics.

The two platforms expose it differently, which is the trap:

- **Android** — a **compose modifier**, `modifiers={[testID('…')]}` from
  `@expo/ui/jetpack-compose/modifiers`. Not a prop, so it is absent from `SwitchProps` and easy to
  conclude doesn't exist. It was moved to modifiers in
  [expo/expo#39155](https://github.com/expo/expo/pull/39155); Android support originally landed in
  [#38005](https://github.com/expo/expo/pull/38005).
- **iOS** — a plain `testID` **prop**, via `CommonViewModifierProps` ("Used to locate this view in
  end-to-end tests"), added in [#37919](https://github.com/expo/expo/pull/37919).

`jetpack-compose/modifiers` also has `semantics({ contentType })`, `toggleable(value, handler,
{ role })` for making a whole row togglable with a `'switch'`/`'checkbox'` role, and
`selectableGroup()`. SwiftUI has `accessibilityHidden`, `accessibilityIdentifier` and
`accessibilityInputLabels` modifiers (SDK 56.0.16), plus `accessibilityAddTraits`/`RemoveTraits` and
`accessibilityElement` in 57.0.3.

**So: every migrated control must take and forward `testID`.** Treat a control that doesn't as an
accessibility bug, not as an upstream constraint.

### Correction: containers **can** host interactive RN children (`RNHostView` works)

The earlier note that containers "cannot" be migrated because `ComposeClick` never fires, and that
the `RNHostView` bridge "was tried and did not fix it", **does not hold on `@expo/ui` 56.0.16**.

Probed directly on-device: an RN `Pressable` inside a Compose `Column`, wrapped in `RNHostView`,
receives every tap. Counters incremented 1→4 over three taps and 1→3 over two, with a pure-RN
control alongside confirming taps weren't being double-counted. Both `matchContents` and
`style={{ position: 'absolute' }}` variants worked, and the RN children rendered with their own
styling intact inside the Compose parent.

Why the earlier attempt probably failed: the Expo docs are explicit that the shadow node's style must
match the Compose component's visual position — *"Misalignment causes hit-testing failures for
interactive elements like `Pressable`"*. That's a fixable layout problem, not a hard limit. Note also
that `matchContents` **cannot change after mount**, so it must be chosen correctly up front — a
likely source of a "it just doesn't work" conclusion.

Relevant upstream history (both repos are on 56.0.16):

- `RNHostView` added for Android in [#43495](https://github.com/expo/expo/pull/43495) (56.0.0);
  `RNHost` for iOS in [#40938](https://github.com/expo/expo/pull/40938) (55.0.12).
- Touch fixes for RN children inside Compose landed in
  [#46778](https://github.com/expo/expo/pull/46778) and
  [#46805](https://github.com/expo/expo/pull/46805) (56.0.16) — i.e. *at* the installed version, so
  an attempt made before it would legitimately have failed.
- Further scroll/touch fixes in 56.0.17 ([#47245](https://github.com/expo/expo/pull/47245)) and
  57.x, so upgrading is worth doing before concluding anything else is impossible.

One real caveat, consistent with the `testID` finding above: RN children inside `RNHostView` expose
**no** accessibility node of their own (only the pure-RN control did in the probe). So container
migrations need explicit attention to a11y/E2E selectors, not just to whether touches land.

**The leaf-vs-container split should therefore be re-tested, not assumed.** It is a version artefact,
not an architectural boundary.

### Rig gap this exposed: PackRat's deps don't resolve from outside its repo

Bringing Android up surfaced three Metro failures, all one root cause: PackRat's source sits outside
the test app's project root, so Metro's resolution never reaches PackRat's own `node_modules`. Fixed
in `nativewindui@fce2767` (aliases for the sibling `@packrat/*` packages, a `resolveRequest` hook
that retries via Node's resolver rooted in PackRat, and watching PackRat's `node_modules` so the
resolved files can be hashed). Verified exactly one copy of `react` in the output bundle.

Note `bun check:migration`'s "24/24, 100%" counts components moved off nativewindui, **not**
components on `@expo/ui`. Only three are actually native today: `loading-indicator`,
`segmented-control`, `toggle`.

## SDK 57 migration pass (2026-08-04)

Upgraded to Expo SDK 57 (`@expo/ui` 57.0.9, RN 0.86.2) first, because the RN-children-in-Compose
fixes the container work depends on landed in 56.0.17 and 57.x. `check-types` clean on the upgrade
alone. `packages/ui` had pinned `@expo/ui` at `^56.0.9`, which silently held node_modules at 56.0.16
even after `apps/expo` moved — both are now `~57.0.9`.

### Drop-in replacements did most of the work

`@expo/ui` ships eight [API-compatible replacements](https://docs.expo.dev/versions/latest/sdk/ui/drop-in-replacements/)
for popular community libraries; the docs say *"Most migrations only require changing the import."*
That held. Four packages removed from `package.json` outright:

| Was | Now | Call sites |
|---|---|---|
| `@gorhom/bottom-sheet` | `@expo/ui/community/bottom-sheet` | 17 files |
| `@react-native-community/datetimepicker` | `@expo/ui/community/datetime-picker` | 1 |
| `@react-native-picker/picker` | `@expo/ui/community/picker` | 1 |
| `@react-native-masked-view/masked-view` | `@expo/ui/community/masked-view` | 1 |

`Sheet` is now a real SwiftUI sheet / Material 3 `ModalBottomSheet`, and `present()`/`dismiss()`/
`onDismiss` keep `@gorhom`'s contract so no call site logic changed. Three prop groups were dropped
because the native sheet owns them and passing them did nothing: the custom `BottomSheetBackdrop`,
`handleIndicatorStyle` (9 sites), and the `style` border/radius. Safe-area `topInset`/`bottomInset`
went too (7 sites) — the platform sheet insets its own content.

Two pieces of scaffolding also became unnecessary: datetimepicker's config plugin (native code now
comes from `@expo/ui`) and its metro web stub (`@expo/ui` ships a real `.web` implementation).

`BottomSheetView` is re-exported as `SheetView` with `cssInterop` applied — `@expo/ui`'s sheet types
are hand-written rather than extending `ViewProps`, so NativeWind's `className` augmentation doesn't
reach them. Same fix as `Host` in `toggle.{ios,android}.tsx`.

### `Checkbox`: Android only, deliberately

`checkbox.android.tsx` is now the Material 3 `Checkbox`. **iOS stays on RN** — SwiftUI has no
checkbox toggle style, only a switch, so routing iOS through `@expo/ui` would render every checkbox
as a switch. A checkmark is also the iOS convention. Not a stopgap; the right end state.

### `TextField`: deliberately NOT migrated

The native `TextField` has all seven decoration slots we'd want (`Label`, `Placeholder`,
`LeadingIcon`, `TrailingIcon`, `Prefix`, `Suffix`, `SupportingText`) — but it **does not accept a
React string `value`**. State must live in native observable state via
[`useNativeState`](https://docs.expo.dev/versions/latest/sdk/ui/jetpack-compose/usenativestate/),
which deliberately bypasses the JS thread.

That is a fundamental mismatch with TanStack Form, which is controlled-only by design. Of 34
`<TextField>` call sites, 16 are controlled and 10 are wired to `field.state.value`. Migrating would
mean replacing declarative form binding with imperative workarounds across those files, risking
validation behaviour — and buying nothing visually, because RN's `TextInput` already renders a
native `EditText`/`UITextField`.

Revisit only if `@expo/ui` grows a controlled `value: string` prop.

### Containers: `RNHostView` works for touches but not for layout

The earlier correction stands — **touches do fire** through `RNHostView`, so "`ComposeClick` never
fires" is not the blocker. Verified again with the real migrated `Card` on-device: an RN `Button` in
the card footer incremented a counter to `TAPS 2`. Interactivity is genuinely solved.

**Layout is the actual blocker — but the mechanism below was wrong. See the correction under
"SDK 57 migration pass" for what was actually ruled in and out.**

The original (56.0.16-era) reading was that `RNHostView`'s two sizing modes are mutually exclusive
for a content-sized container: `matchContents` leaves the RN subtree with no width constraint so flex
collapses, and omitting it gives the card no intrinsic height so it renders at zero height.
`matchContents` also cannot change after mount.

Half of that survives re-testing on 57 (omitting `matchContents` does render nothing), but the
`matchContents` half does **not** — see the correction. Do not cite this paragraph as the reason
containers can't migrate.

Expo's own `Card` documentation does only ever put Compose primitives (`Text`, `Column`) inside a
`Card`, never RN children — that remains true and is a signal about intended usage, but it is not
proof of impossibility.

`Card` was implemented, tested, and **reverted** — twice, on two different SDK versions, for reasons
that turned out to be different each time.

The same structural mismatch rules out the other containers, each for a concrete reason:

| Component | Native equivalent | Why not |
|---|---|---|
| `card` | `Card` | Content-sized surface wrapping arbitrary RN children — the sizing conflict above. Tested and reverted. |
| `list` | `LazyColumn` | `list.tsx` is `FlashList`; there is no native equivalent for its virtualization/recycling API, and every item's content is arbitrary RN. |
| `alert` (Android) | `AlertDialog` | Slots are Title/Text/Confirm/Dismiss/Icon only — no text input. `prompt()` is used for typed delete-account confirmation. iOS already renders a real `UIAlertController` via RN core. |
| `form`, `toolbar` | — | Pure RN layout wrapping arbitrary children; same sizing conflict, no styling gain. |

### Where this leaves the migration

`@expo/ui` is the right tool for **leaf controls** (self-contained native widgets: switch, checkbox,
slider, segmented control) and for **whole-surface drop-in replacements** (bottom sheet, picker,
date picker, masked view) where the native component owns its own dimensions.

It is *not* currently a tool for wrapping arbitrary React Native subtrees in native containers.
Until `RNHostView` can take a width constraint from the Compose parent while still reporting its
content height, container migration means breaking layout — so the remaining containers stay RN by
choice, not by oversight.

## Correction: what actually blocks `Card` on SDK 57 (2026-08-04, second attempt)

The 56-era explanation above was re-tested on `@expo/ui` 57.0.9 and is **wrong about the mechanism**.
Isolated one variable at a time in the rig, on Android hardware:

| Probe | Result |
|---|---|
| `matchContents` on both `Host` and `RNHostView`, child sized only by `flex: 1` | **Renders correctly.** Card is a real 624×129 box, the `flex-1` label wraps inside it, the trailing pill keeps its background. |
| Same + an explicit numeric width on the child | Renders correctly. |
| **No** `matchContents` on `RNHostView` | Zero height, nothing visible. (This half of the old claim holds.) |
| NativeWind `className` vs inline `style` on hosted children | **Identical.** `cssInterop` reaches inside `RNHostView` fine. |
| `BlurView` (`expo-blur`, a third-party native view, as `CardFooter` uses) hosted inside | Renders correctly. |

So `matchContents` does **not** starve the subtree of a width constraint, `className` is not lost, and
a nested native view is not the problem. Part of why the first attempt failed is version: the
`Pressable`-in-`RNHostView` fix ([expo/expo#48131](https://github.com/expo/expo/issues/48131)) landed
in **57.0.8**, and `RNHostView` now sets `layoutRoot: true` specifically so `measure()` reports the
right coordinate space. The original Card test ran on 56.0.16, before any of that.

**But the real `Card` still renders wrong on 57**, with a distinctive signature: collapsed font sizes,
the footer `Button` losing its background, and — the useful clue — **no accessibility nodes at all**
for the hosted subtree (`uiautomator` sees the old card's `Card Title`/`Action` nodes and nothing for
the new one), even though pixels are painted. Ruled out along the way: dynamic component variable +
spread props (rewritten as literal JSX tags per branch, no change).

That points at something specific to the compound `Card`/`CardContent`/`CardFooter` composition rather
than at `RNHostView`'s contract. It was reverted again rather than shipped half-understood.

**If picking this up:** the isolated mechanisms all work, so bisect the compound structure — build up
from the known-good probe (`Host matchContents` → `Card` → `RNHostView matchContents` → `View`
+ `className`) one Card part at a time until the a11y nodes disappear. The missing-node symptom is
the fastest signal; `uiautomator dump` shows it immediately and doesn't race the renderer the way a
screenshot does.

**Unchanged and still correct:** the `TextField` blocker (`useNativeState` vs TanStack Form) and the
`list` blocker (`FlashList` virtualization has no native equivalent) are independent of all this.

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
