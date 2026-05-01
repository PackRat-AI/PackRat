/**
 * Compile-time coverage check: verifies that index.web.tsx exports every
 * name that @packrat-ai/nativewindui exports natively.
 *
 * How it works: `Pick<T, K>` requires every key in K to exist in T.
 * If any listed export is missing from index.web.tsx, TypeScript will fail here
 * with: "Type '"SomeName"' does not satisfy the constraint 'keyof typeof WebShim'."
 *
 * Run: bun check-types  (included via root tsconfig packages/**\/*.ts glob)
 *
 * When adding new exports to the native package, add them here too.
 */

import type * as WebShim from './index.web';

type _Coverage = Pick<
  typeof WebShim,
  // --- Utilities ---
  | 'cn'
  | 'useColorScheme'
  | 'useHeaderSearchBar'
  | 'addOpacityToRgb'
  | 'withOpacity'
  | 'COLORS'
  | 'NAV_THEME'
  // --- Core components ---
  | 'ActivityIndicator'
  | 'Avatar'
  | 'AvatarFallback'
  | 'AvatarImage'
  | 'Badge'
  | 'Button'
  | 'buttonVariants'
  | 'buttonTextVariants'
  // --- Card ---
  | 'Card'
  | 'CardBadge'
  | 'CardContent'
  | 'CardDescription'
  | 'CardFooter'
  | 'CardImage'
  | 'CardSubtitle'
  | 'CardTitle'
  // --- Checkbox / Form ---
  | 'Checkbox'
  | 'Form'
  | 'FormItem'
  | 'FormSection'
  // --- Drawer ---
  | 'DrawerContentRoot'
  | 'DrawerContentSection'
  | 'DrawerContentSectionItem'
  | 'DrawerContentSectionTitle'
  | 'getActiveDrawerContentScreen'
  // --- List ---
  | 'List'
  | 'ListItem'
  | 'ListSectionHeader'
  | 'getStickyHeaderIndices'
  // --- Picker / Stepper / Slider / Progress ---
  | 'Picker'
  | 'PickerItem'
  | 'ProgressIndicator'
  | 'Slider'
  | 'Stepper'
  // --- Sheet ---
  | 'Sheet'
  | 'useSheetRef'
  // --- Text / TextField / SearchInput ---
  | 'Text'
  | 'TextClassContext'
  | 'textVariants'
  | 'TextField'
  | 'SearchInput'
  // --- Toggle / ThemeToggle ---
  | 'Toggle'
  | 'ThemeToggle'
  // --- Toolbar ---
  | 'Toolbar'
  | 'ToolbarCTA'
  | 'ToolbarIcon'
  // --- Alert ---
  | 'Alert'
  | 'AlertAnchor'
  // --- AdaptiveSearchHeader ---
  | 'AdaptiveSearchHeader'
  | 'isLiquidGlassSupported'
  // --- ContextMenu ---
  | 'ContextMenu'
  | 'ContextMenuCheckboxItem'
  | 'ContextMenuContent'
  | 'ContextMenuGroup'
  | 'ContextMenuItem'
  | 'ContextMenuLabel'
  | 'ContextMenuPortal'
  | 'ContextMenuRadioGroup'
  | 'ContextMenuRadioItem'
  | 'ContextMenuSeparator'
  | 'ContextMenuShortcut'
  | 'ContextMenuSub'
  | 'ContextMenuSubContent'
  | 'ContextMenuSubTrigger'
  | 'ContextMenuTrigger'
  | 'createContextSubMenu'
  | 'createContextItem'
  // --- DatePicker ---
  | 'DatePicker'
  // --- DropdownMenu ---
  | 'DropdownMenu'
  | 'DropdownMenuCheckboxItem'
  | 'DropdownMenuContent'
  | 'DropdownMenuGroup'
  | 'DropdownMenuItem'
  | 'DropdownMenuLabel'
  | 'DropdownMenuPortal'
  | 'DropdownMenuRadioGroup'
  | 'DropdownMenuRadioItem'
  | 'DropdownMenuSeparator'
  | 'DropdownMenuShortcut'
  | 'DropdownMenuSub'
  | 'DropdownMenuSubContent'
  | 'DropdownMenuSubTrigger'
  | 'DropdownMenuTrigger'
  | 'createDropdownSubMenu'
  | 'createDropdownItem'
  // --- Icon ---
  | 'Icon'
  // --- LargeTitleHeader / SegmentedControl ---
  | 'LargeTitleHeader'
  | 'SegmentedControl'
>;
