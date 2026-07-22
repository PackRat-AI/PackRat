// NativeWindUI → Expo UI migration tracker
//
// Each export line is one component still backed by @packrat-ai/nativewindui.
// Delete a line when its packages/ui/src/ replacement lands.
// When this file is empty: remove @packrat-ai/nativewindui from package.json
// and drop PACKRAT_NATIVEWIND_UI_GITHUB_TOKEN from bunfig.toml.
//
// Run `bun check:migration` for per-phase progress.
// Full plan: docs/migrations/nativewindui-to-expo-ui.md
//
// Phase 1 ✓ done — useColorScheme → expo-app/lib/hooks/useColorScheme, cn → expo-app/lib/cn
// Phase 2 — LargeTitleHeader/SearchInput → Stack.Screen + headerSearchBarOptions
//   LargeTitleHeader ✓ done
//   SearchInput — reverted, pending re-migration
export { SearchInput } from '@packrat-ai/nativewindui'; //   uses → headerSearchBarOptions
export type { SearchInputProps, SearchInputRef } from '@packrat-ai/nativewindui';
//
// Phase 3 — @expo/ui Universal → packages/ui/src/
export { Text, TextClassContext, textVariants } from '@packrat-ai/nativewindui'; // 114 uses → @expo/ui Universal Text
export { Button, buttonVariants, buttonTextVariants } from '@packrat-ai/nativewindui'; //  49 uses → @expo/ui Universal Button
export type { ButtonProps } from '@packrat-ai/nativewindui';
// List/ListItem/ListSectionHeader ✓ done — packages/ui/src/list.tsx, plain RN composition
//   (FlashList + View/Pressable + Text). ListItem uses Pressable, not the migrated Button —
//   nesting a Host-bridged Button around multiple Host-bridged Text children (title+subtitle)
//   reproduces the Button-collapse bug fixed earlier.
export { Sheet, useSheetRef } from '@packrat-ai/nativewindui'; //  16 uses → @expo/ui Universal BottomSheet
export { Form, FormSection, FormItem } from '@packrat-ai/nativewindui'; //  24 uses → @expo/ui Universal FieldGroup + SwiftUI Form
// TextField ✓ done — packages/ui/src/text-field.tsx (Android/default, Material floating label)
//   + text-field.ios.tsx (simple, matches the old package's platform split exactly).
// Toggle ✓ done — packages/ui/src/toggle.tsx wraps react-native's Switch directly (already RN-native, no Host risk)
//
// Phase 4 — @expo/ui platform-specific wrappers (.ios.tsx + .android.tsx) in packages/ui/src/
// ActivityIndicator ✓ done — packages/ui/src/loading-indicator.ios.tsx + .android.tsx
export { Alert, AlertAnchor } from '@packrat-ai/nativewindui'; //  14 uses → @expo/ui SwiftUI Alert + JC AlertDialog
export type { AlertMethods } from '@packrat-ai/nativewindui'; //  14 uses
// Card ✓ done — packages/ui/src/card.tsx, plain RN composition (no native Host needed).
//   CardBadge/CardImage dropped — zero real call sites used them; re-add from the old
//   Card.tsx source (git history) if a future screen needs them.
// SegmentedControl ✓ done — packages/ui/src/segmented-control.tsx wraps @expo/ui community SegmentedControl
// Checkbox ✓ done — packages/ui/src/checkbox.tsx wraps @rn-primitives/checkbox directly (already RN-native, no Host risk)
export { ContextMenu, createContextItem, createContextSubMenu } from '@packrat-ai/nativewindui'; //   multiple uses → SwiftUI ContextMenu + JC DropdownMenu
export type { ContextMenuMethods } from '@packrat-ai/nativewindui';
export { DropdownMenu, createDropdownItem, createDropdownSubMenu } from '@packrat-ai/nativewindui'; //   multiple uses → @expo/ui DropdownMenu
export { Toolbar, ToolbarCTA, ToolbarIcon } from '@packrat-ai/nativewindui'; //   multiple uses → platform-specific Toolbar
//
// Phase 5 — no @expo/ui equivalent
// Avatar ✓ done — packages/ui/src/avatar.tsx wraps @rn-primitives/avatar directly
