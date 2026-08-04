// NativeWindUI → Expo UI migration tracker — COMPLETE
//
// Every component originally exported from this file has been ported to packages/ui/src/.
// @packrat-ai/nativewindui has been removed from packages/ui/package.json and apps/expo's
// direct dependency; PACKRAT_NATIVEWIND_UI_GITHUB_TOKEN has been dropped from bunfig.toml.
//
// Full history: docs/migrations/nativewindui-to-expo-ui.md
//
// Phase 1 ✓ done — useColorScheme → expo-app/lib/hooks/useColorScheme, cn → expo-app/lib/cn
// Phase 2 ✓ done — LargeTitleHeader → Stack.Screen; SearchInput → packages/ui/src/search-input.tsx + .ios.tsx
//
// Phase 3 ✓ done — @expo/ui Universal → packages/ui/src/
//   Text/Button/TextClassContext/textVariants/buttonVariants/buttonTextVariants → text.tsx, button.tsx
//   List/ListItem/ListSectionHeader → list.tsx (plain RN — FlashList + View/Pressable/Text)
//   Sheet/useSheetRef → bottom-sheet.tsx (@expo/ui/community/bottom-sheet — native sheet)
//   Form/FormSection/FormItem → form.tsx (plain RN)
//   TextField → text-field.tsx + .ios.tsx (plain RN — @expo/ui's TextField requires native
//     observable state via useNativeState, incompatible with TanStack Form's controlled model)
//   Toggle → toggle.{ios,android}.tsx (@expo/ui SwiftUI Toggle / M3 Switch), toggle.tsx (RN, web)
//
// Phase 4 ✓ done — platform-specific wrappers → packages/ui/src/
//   ActivityIndicator → loading-indicator.ios.tsx + .android.tsx (@expo/ui)
//   Alert/AlertAnchor → alert.tsx (@rn-primitives/alert-dialog) + alert.ios.tsx (RN core Alert)
//   Card → card.tsx (plain RN — a native Card cannot size RN children; see the migration doc)
//   SegmentedControl → segmented-control.tsx (@expo/ui community SegmentedControl)
//   Checkbox → checkbox.android.tsx (@expo/ui M3 Checkbox); checkbox.tsx (@rn-primitives) on
//     iOS/web — SwiftUI has no checkbox toggle style, only a switch
//   ContextMenu/createContextItem/createContextSubMenu → context-menu/ (@rn-primitives/context-menu,
//     react-native-ios-context-menu on iOS)
//   DropdownMenu/createDropdownItem/createDropdownSubMenu → dropdown-menu/ (@rn-primitives/dropdown-menu,
//     react-native-ios-context-menu on iOS)
//   Toolbar/ToolbarCTA/ToolbarIcon → toolbar.tsx (expo-blur)
//
// Phase 5 ✓ done — no @expo/ui equivalent
//   Avatar → avatar.tsx (@rn-primitives/avatar)
//   selectable/uiTextView text → selectable-text.tsx (react-native-uitextview directly — the
//     same underlying native module the old package used for this feature; no @expo/ui
//     equivalent exists on any platform for text selection)
