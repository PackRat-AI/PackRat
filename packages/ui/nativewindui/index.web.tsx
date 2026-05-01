/**
 * Web adapter barrel for @packrat/ui/nativewindui.
 * Metro resolves this file over index.ts when bundling for web.
 * Native builds continue to use index.ts → @packrat-ai/nativewindui.
 *
 * Every named export from @packrat-ai/nativewindui must appear here.
 * Real implementations are backed by @packrat/web-ui (shadcn) or custom shims.
 * See web-shim-coverage.ts for the compile-time completeness check.
 */

import { Switch } from '@packrat/web-ui/components/switch';
import type { ComponentProps } from 'react';

// ---------------------------------------------------------------------------
// Utilities
// ---------------------------------------------------------------------------

export { cn } from './cn.web';

// ---------------------------------------------------------------------------
// useColorScheme + theme tokens
// ---------------------------------------------------------------------------

export {
  addOpacityToRgb,
  COLORS,
  NAV_THEME,
  useColorScheme,
  withOpacity,
} from './use-color-scheme.web';

// ---------------------------------------------------------------------------
// Real shimmed components
// ---------------------------------------------------------------------------

export { ActivityIndicator } from './activity-indicator.web';
export type { ButtonProps } from './button.web';
export { Button, buttonTextVariants, buttonVariants } from './button.web';
export { CardBadge, CardImage, CardSubtitle } from './card-extras.web';
export {
  DrawerContentRoot,
  DrawerContentSection,
  DrawerContentSectionItem,
  DrawerContentSectionTitle,
  getActiveDrawerContentScreen,
} from './drawer-content.web';
export { Icon } from './icon.web';
export type { LargeTitleHeaderProps, LargeTitleSearchBarMethods } from './large-title-header.web';
export { LargeTitleHeader } from './large-title-header.web';
export type {
  ListDataItem,
  ListItemProps,
  ListProps,
  ListRef,
  ListRenderItemInfo,
  ListSectionHeaderProps,
} from './list.web';
export {
  getStickyHeaderIndices,
  List,
  ListItem,
  ListSectionHeader,
} from './list.web';
export { Picker, PickerItem } from './picker.web';
export { SearchInput } from './search-input.web';
export type { SegmentedControlProps } from './segmented-control.web';
export { SegmentedControl } from './segmented-control.web';
export type { SheetRef } from './sheet.web';
export { Sheet, useSheetRef } from './sheet.web';
export { Stepper } from './stepper.web';
export { Text, TextClassContext, textVariants } from './text.web';
export { TextField } from './text-field.web';
export { ThemeToggle } from './theme-toggle.web';
export { Toolbar, ToolbarCTA, ToolbarIcon } from './toolbar.web';

// useHeaderSearchBar — noop on web
export function useHeaderSearchBar() {
  return { isSearching: false, searchQuery: '' };
}

// ---------------------------------------------------------------------------
// Toggle: nativewindui uses value/onValueChange; shadcn Switch uses
// checked/onCheckedChange — bridge the props here so screen code works on web.
// ---------------------------------------------------------------------------

type ToggleProps = {
  value?: boolean;
  onValueChange?: (val: boolean) => void;
} & Omit<ComponentProps<typeof Switch>, 'checked' | 'onCheckedChange'>;

export function Toggle({ value, onValueChange, ...rest }: ToggleProps) {
  return <Switch checked={value} onCheckedChange={onValueChange} {...rest} />;
}

// ---------------------------------------------------------------------------
// @packrat/web-ui shadcn components — direct re-exports via deep imports.
// Using component-level paths because the @packrat/web-ui barrel only
// exports Button + cn; everything else is in ./components/*.
// (Switch excluded above; wrapped as Toggle instead)
// ---------------------------------------------------------------------------

export { Avatar, AvatarFallback, AvatarImage } from '@packrat/web-ui/components/avatar';
export { Badge } from '@packrat/web-ui/components/badge';
export {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@packrat/web-ui/components/card';
export { Checkbox } from '@packrat/web-ui/components/checkbox';
export {
  ContextMenu,
  ContextMenuCheckboxItem,
  ContextMenuContent,
  ContextMenuGroup,
  ContextMenuItem,
  ContextMenuLabel,
  ContextMenuPortal,
  ContextMenuRadioGroup,
  ContextMenuRadioItem,
  ContextMenuSeparator,
  ContextMenuShortcut,
  ContextMenuSub,
  ContextMenuSubContent,
  ContextMenuSubTrigger,
  ContextMenuTrigger,
} from '@packrat/web-ui/components/context-menu';
export {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuPortal,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from '@packrat/web-ui/components/dropdown-menu';
export { Progress as ProgressIndicator } from '@packrat/web-ui/components/progress';
export { Slider } from '@packrat/web-ui/components/slider';

// ---------------------------------------------------------------------------
// Alert
// ---------------------------------------------------------------------------

export { Alert, AlertAnchor, type AlertMethods } from './alert.web';

// ---------------------------------------------------------------------------
// Form
// ---------------------------------------------------------------------------

export { Form, FormItem, FormSection } from './form.web';

// ---------------------------------------------------------------------------
// AdaptiveSearchHeader — iOS liquid glass, no web equivalent
// ---------------------------------------------------------------------------

export const AdaptiveSearchHeader = () => null;
export const isLiquidGlassSupported = false;

// Type stubs for native-only AdaptiveSearchHeader types
export type AdaptiveSearchBarMethods = Record<string, never>;
export type AdaptiveSearchHeaderProps = Record<string, never>;

// ---------------------------------------------------------------------------
// DatePicker — shadcn Calendar available but no web screens use it yet
// ---------------------------------------------------------------------------

export const DatePicker = () => null;

// ---------------------------------------------------------------------------
// ContextMenu / DropdownMenu utils (imperative helper fns from nativewindui)
// ---------------------------------------------------------------------------

export const createContextSubMenu = <T extends object>(
  subMenu: T,
  items: unknown[],
): T & { items: unknown[] } => ({ ...subMenu, items });
export const createContextItem = <T,>(item: T): T => item;
export const createDropdownSubMenu = <T extends object>(
  subMenu: T,
  items: unknown[],
): T & { items: unknown[] } => ({ ...subMenu, items });
export const createDropdownItem = <T,>(item: T): T => item;

// Type stubs for native-only ref types
export type ContextMenuMethods = Record<string, never>;
