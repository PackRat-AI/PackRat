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
- **`matchContents` is conditional, not on/off.** Two real, opposite bugs were caught on-device:
  1. Always passing `matchContents` sizes the box to its native content, which fights `flex-1` — a `flex-1 mr-2` header label collapsed to its intrinsic width and overlapped its sibling instead of stretching.
  2. Always omitting `matchContents` leaves a `Host` with no `className`/`style` sizing hint (e.g. `<Text className="font-medium">Weight</Text>` — a plain label, no layout classes) with nothing to size itself by, so it collapses to zero height. Two stacked labels like this rendered on top of each other instead of one above the other.
  The fix (`packages/ui/src/lib/text-class-parser.ts` — `shouldMatchContents`/`hasExplicitSizing`): `matchContents` is set only when the `Host`-bound `className` has none of `flex-1`/`flex-auto`/`flex-grow`/`self-stretch`/`w-*`/`h-*`/`min-w-*`/`min-h-*`. Present → Yoga sizes the box (`matchContents: false`). Absent → the box sizes to its native content (`matchContents: true`).
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
| `TextField` | 9 | `TextInput` | U | `src/text-input.tsx` |
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
