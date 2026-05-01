/**
 * Web adapter barrel for @packrat/ui/nativewindui.
 * Metro resolves this file over index.ts when bundling for web.
 * Native builds continue to use index.ts → @packrat-ai/nativewindui.
 *
 * Every named export from @packrat-ai/nativewindui must appear here.
 * Components not shimmed are exported as null stubs to prevent import errors.
 */
import { type ClassValue, clsx } from 'clsx';
import type * as React from 'react';
import { twMerge } from 'tailwind-merge';

// ---------------------------------------------------------------------------
// Utilities (inline — tsconfig path aliases don't resolve at Metro runtime)
// ---------------------------------------------------------------------------

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// ---------------------------------------------------------------------------
// useColorScheme — matches @packrat-ai/nativewindui API including `colors`
// ---------------------------------------------------------------------------

import { useColorScheme as useNativewindColorScheme } from 'nativewind';

const STUB_COLORS = {
  white: 'rgb(255, 255, 255)',
  black: 'rgb(0, 0, 0)',
  grey6: 'rgb(242, 242, 247)',
  grey5: 'rgb(230, 230, 235)',
  grey4: 'rgb(210, 210, 215)',
  grey3: 'rgb(199, 199, 204)',
  grey2: 'rgb(175, 176, 180)',
  grey: 'rgb(142, 142, 147)',
  background: 'rgb(255, 255, 255)',
  foreground: 'rgb(0, 0, 0)',
  root: 'rgb(255, 255, 255)',
  card: 'rgb(255, 255, 255)',
  cardForeground: 'rgb(8, 28, 30)',
  popover: 'rgb(230, 230, 235)',
  popoverForeground: 'rgb(0, 0, 0)',
  destructive: 'rgb(255, 56, 43)',
  primary: 'rgb(0, 123, 254)',
  primaryForeground: 'rgb(255, 255, 255)',
  secondary: 'rgb(45, 175, 231)',
  secondaryForeground: 'rgb(255, 255, 255)',
  muted: 'rgb(175, 176, 180)',
  mutedForeground: 'rgb(142, 142, 147)',
  accent: 'rgb(255, 40, 84)',
  accentForeground: 'rgb(255, 255, 255)',
  border: 'rgb(230, 230, 235)',
  input: 'rgb(210, 210, 215)',
  notification: 'rgb(255, 56, 43)',
};

const DARK_STUB_COLORS = {
  ...STUB_COLORS,
  background: 'rgb(0, 0, 0)',
  foreground: 'rgb(255, 255, 255)',
  root: 'rgb(0, 0, 0)',
  card: 'rgb(18, 18, 18)',
  cardForeground: 'rgb(255, 255, 255)',
  grey6: 'rgb(28, 28, 30)',
  grey5: 'rgb(44, 44, 46)',
  grey4: 'rgb(58, 58, 60)',
  grey3: 'rgb(72, 72, 74)',
  grey2: 'rgb(99, 99, 102)',
  grey: 'rgb(142, 142, 147)',
};

export function useColorScheme() {
  const { colorScheme, setColorScheme } = useNativewindColorScheme();
  const scheme = colorScheme ?? 'light';

  return {
    colorScheme: scheme,
    isDarkColorScheme: scheme === 'dark',
    setColorScheme,
    toggleColorScheme: () => setColorScheme(scheme === 'light' ? 'dark' : 'light'),
    colors: scheme === 'dark' ? DARK_STUB_COLORS : STUB_COLORS,
  };
}

// ---------------------------------------------------------------------------
// Theme exports (stubs — values not needed for PoC rendering)
// ---------------------------------------------------------------------------

export const COLORS = { light: STUB_COLORS, dark: DARK_STUB_COLORS };
export const NAV_THEME = { light: {}, dark: {} };
export const withOpacity = () => '';

// ---------------------------------------------------------------------------
// Real shimmed components
// ---------------------------------------------------------------------------

export { ActivityIndicator } from './activity-indicator.web';
export type { ButtonProps } from './button.web';
export { Button, buttonTextVariants, buttonVariants } from './button.web';
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
export type { SegmentedControlProps } from './segmented-control.web';
export { SegmentedControl } from './segmented-control.web';
export type { SheetRef } from './sheet.web';
export { Sheet, useSheetRef } from './sheet.web';
export { Text, TextClassContext, textVariants } from './text.web';

// useHeaderSearchBar — noop on web
export function useHeaderSearchBar() {
  return { isSearching: false, searchQuery: '' };
}

// ---------------------------------------------------------------------------
// Null stubs for components not used in Packs screens
// ---------------------------------------------------------------------------

const stub = () => null;

export const Avatar = stub;
export const AvatarFallback = stub;
export const AvatarImage = stub;

export const Badge = stub;

export const Card = ({ children }: { children?: React.ReactNode }) => <div>{children}</div>;
export const CardBadge = stub;
export const CardContent = ({ children }: { children?: React.ReactNode }) => <div>{children}</div>;
export const CardDescription = stub;
export const CardFooter = ({ children }: { children?: React.ReactNode }) => <div>{children}</div>;
export const CardImage = stub;
export const CardSubtitle = stub;
export const CardTitle = ({ children }: { children?: React.ReactNode }) => (
  <div className="font-semibold">{children}</div>
);
export const addOpacityToRgb = (rgb: string, opacity: number) =>
  rgb.replace('rgb(', 'rgba(').replace(')', `, ${opacity})`);

export const Checkbox = stub;

export const DrawerContentRoot = ({ children }: { children?: React.ReactNode }) => (
  <div>{children}</div>
);
export const DrawerContentSection = ({ children }: { children?: React.ReactNode }) => (
  <div>{children}</div>
);
export const DrawerContentSectionItem = stub;
export const DrawerContentSectionTitle = stub;
export const getActiveDrawerContentScreen = () => null;

export const Form = ({ children }: { children?: React.ReactNode }) => <form>{children}</form>;
export const FormItem = ({ children }: { children?: React.ReactNode }) => <div>{children}</div>;
export const FormSection = ({ children }: { children?: React.ReactNode }) => <div>{children}</div>;

export const Picker = stub;
export const PickerItem = stub;

export const ProgressIndicator = stub;

export const Slider = stub;
export const Stepper = stub;

export const Toggle = stub;

export const Toolbar = ({ children }: { children?: React.ReactNode }) => (
  <div className="flex gap-2">{children}</div>
);
export const ToolbarCTA = stub;
export const ToolbarIcon = stub;

export const ThemeToggle = stub;

// Alert — renders children as a pass-through (button inside still works)
export const Alert = ({ children }: { children?: React.ReactNode }) => <>{children}</>;
export const AlertMethods = {};

// AdaptiveSearchHeader
export const AdaptiveSearchHeader = stub;
export const isLiquidGlassSupported = false;

// ContextMenu
export const ContextMenu = ({ children }: { children?: React.ReactNode }) => <>{children}</>;
export const ContextMenuContent = stub;
export const ContextMenuItem = stub;
export const ContextMenuTrigger = ({ children }: { children?: React.ReactNode }) => <>{children}</>;
export const ContextMenuCheckboxItem = stub;
export const ContextMenuLabel = stub;
export const ContextMenuRadioGroup = stub;
export const ContextMenuRadioItem = stub;
export const ContextMenuSeparator = stub;
export const ContextMenuShortcut = stub;
export const ContextMenuSub = stub;
export const ContextMenuSubContent = stub;
export const ContextMenuSubTrigger = stub;

// DatePicker
export const DatePicker = stub;

// DropdownMenu
export const DropdownMenu = ({ children }: { children?: React.ReactNode }) => <>{children}</>;
export const DropdownMenuCheckboxItem = stub;
export const DropdownMenuContent = stub;
export const DropdownMenuGroup = stub;
export const DropdownMenuItem = stub;
export const DropdownMenuLabel = stub;
export const DropdownMenuPortal = stub;
export const DropdownMenuRadioGroup = stub;
export const DropdownMenuRadioItem = stub;
export const DropdownMenuSeparator = stub;
export const DropdownMenuShortcut = stub;
export const DropdownMenuSub = stub;
export const DropdownMenuSubContent = stub;
export const DropdownMenuSubTrigger = stub;
export const DropdownMenuTrigger = ({ children }: { children?: React.ReactNode }) => (
  <>{children}</>
);

// Icon
export const Icon = stub;

// SearchInput
export const SearchInput = stub;

// TextField
export const TextField = stub;

// ContextMenu utils
export const createContextSubMenu = (subMenu: object, items: unknown[]) =>
  Object.assign(subMenu, { items });
export const createContextItem = (item: unknown) => item;

// DropdownMenu utils
export const createDropdownSubMenu = (subMenu: object, items: unknown[]) =>
  Object.assign(subMenu, { items });
export const createDropdownItem = (item: unknown) => item;
