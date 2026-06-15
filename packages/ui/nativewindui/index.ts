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
// Phase 2 ✓ done — LargeTitleHeader/SearchInput → Stack.Screen + headerSearchBarOptions
//
// Phase 3 — @expo/ui Universal → packages/ui/src/
export { Text, TextClassContext, textVariants } from '@packrat-ai/nativewindui'; // 114 uses → @expo/ui Universal Text
export { Button, buttonVariants, buttonTextVariants } from '@packrat-ai/nativewindui'; //  49 uses → @expo/ui Universal Button
export type { ButtonProps } from '@packrat-ai/nativewindui';
export {
  ListItem,
  List,
  ListSectionHeader,
  getStickyHeaderIndices,
} from '@packrat-ai/nativewindui'; //  22 uses → @expo/ui Universal ListItem + List
export type {
  ListDataItem,
  ListItemProps,
  ListProps,
  ListRef,
  ListRenderItemInfo,
  ListSectionHeaderProps,
} from '@packrat-ai/nativewindui';
export { Sheet, useSheetRef } from '@packrat-ai/nativewindui'; //  16 uses → @expo/ui Universal BottomSheet
export { Form, FormSection, FormItem } from '@packrat-ai/nativewindui'; //  24 uses → @expo/ui Universal FieldGroup + SwiftUI Form
export { TextField } from '@packrat-ai/nativewindui'; //   9 uses → @expo/ui Universal TextInput
export type { TextFieldProps, TextFieldRef } from '@packrat-ai/nativewindui';
export { Toggle } from '@packrat-ai/nativewindui'; //   1 use  → @expo/ui Universal Switch
//
// Phase 4 — @expo/ui platform-specific wrappers (.ios.tsx + .android.tsx) in packages/ui/src/
export { ActivityIndicator } from '@packrat-ai/nativewindui'; //  22 uses → ProgressView (iOS) + LoadingIndicator (Android)
export { Alert, AlertAnchor } from '@packrat-ai/nativewindui'; //  14 uses → @expo/ui SwiftUI Alert + JC AlertDialog
export type { AlertMethods } from '@packrat-ai/nativewindui'; //  14 uses
export {
  Card,
  CardContent,
  CardTitle,
  CardBadge,
  CardDescription,
  CardFooter,
  CardImage,
  CardSubtitle,
} from '@packrat-ai/nativewindui'; //   8 uses → JC Card (Android) + custom View (iOS)
export { SegmentedControl } from '@packrat-ai/nativewindui'; //   3 uses → @expo/ui community SegmentedControl
export { Checkbox } from '@packrat-ai/nativewindui'; //   3 uses → @expo/ui Universal Checkbox
export { ContextMenu, createContextItem, createContextSubMenu } from '@packrat-ai/nativewindui'; //   multiple uses → SwiftUI ContextMenu + JC DropdownMenu
export type { ContextMenuMethods } from '@packrat-ai/nativewindui';
export { DropdownMenu, createDropdownItem, createDropdownSubMenu } from '@packrat-ai/nativewindui'; //   multiple uses → @expo/ui DropdownMenu
export { Toolbar, ToolbarCTA, ToolbarIcon } from '@packrat-ai/nativewindui'; //   multiple uses → platform-specific Toolbar
//
// Phase 5 — no @expo/ui equivalent
export { Avatar, AvatarFallback, AvatarImage } from '@packrat-ai/nativewindui'; //   6 uses → @rn-primitives/avatar
