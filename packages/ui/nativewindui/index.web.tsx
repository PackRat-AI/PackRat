/**
 * Web adapter barrel for @packrat/ui/nativewindui.
 * Metro resolves this file over index.ts when bundling for web.
 * Native builds continue to use index.ts → @packrat-ai/nativewindui.
 *
 * Every named export from @packrat-ai/nativewindui must appear here.
 * Real implementations are backed by @packrat/web-ui (shadcn) or custom shims.
 */

import { Switch } from '@packrat/web-ui';
import type { ComponentProps, ReactNode } from 'react';

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
// @packrat/web-ui shadcn components — direct re-exports
// (Switch excluded above; wrapped as Toggle instead)
// ---------------------------------------------------------------------------

export {
  Avatar,
  AvatarFallback,
  AvatarImage,
  Badge,
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
  Checkbox,
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
  Progress as ProgressIndicator,
  Slider,
} from '@packrat/web-ui';

// ---------------------------------------------------------------------------
// Pass-through structural components
// ---------------------------------------------------------------------------

export const DrawerContentRoot = ({ children }: { children?: ReactNode }) => <div>{children}</div>;
export const DrawerContentSection = ({ children }: { children?: ReactNode }) => (
  <div>{children}</div>
);
export const DrawerContentSectionItem = () => null;
export const DrawerContentSectionTitle = () => null;
export const getActiveDrawerContentScreen = () => null;

export const Form = ({ children }: { children?: ReactNode }) => <form>{children}</form>;
export const FormItem = ({ children }: { children?: ReactNode }) => <div>{children}</div>;
export const FormSection = ({ children }: { children?: ReactNode }) => (
  <div className="mb-4">{children}</div>
);

export const Toolbar = ({ children }: { children?: ReactNode }) => (
  <div className="flex gap-2">{children}</div>
);
export const ToolbarCTA = () => null;
export const ToolbarIcon = () => null;

// Alert — renders children as a pass-through (button inside still works)
export const Alert = ({ children }: { children?: ReactNode }) => <>{children}</>;
export type AlertMethods = Record<string, never>;

// ---------------------------------------------------------------------------
// Stubs for native-only or no web equivalent
// ---------------------------------------------------------------------------

const stub = () => null;

// nativewindui-specific Card sub-components with no shadcn equivalent
export const CardBadge = stub;
export const CardImage = stub;
export const CardSubtitle = stub;

// AdaptiveSearchHeader — iOS liquid glass, no web equivalent
export const AdaptiveSearchHeader = stub;
export const isLiquidGlassSupported = false;

// DatePicker — complex, keep as stub for now
export const DatePicker = stub;

// ContextMenu / DropdownMenu utils (imperative helper fns from nativewindui)
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
