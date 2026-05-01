/**
 * Web adapter barrel for @packrat/ui/nativewindui.
 * Metro resolves this file over index.ts when bundling for web.
 * Native builds continue to use index.ts → @packrat-ai/nativewindui.
 *
 * Every named export from @packrat-ai/nativewindui must appear here.
 * Real implementations are backed by @packrat/web-ui (shadcn) or custom shims.
 */
import { type ClassValue, clsx } from 'clsx';
import type * as React from 'react';
import { twMerge } from 'tailwind-merge';

// ---------------------------------------------------------------------------
// Utilities (inlined — tsconfig path aliases don't resolve at Metro runtime)
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
// Theme exports
// ---------------------------------------------------------------------------

export const COLORS = { light: STUB_COLORS, dark: DARK_STUB_COLORS };
export const NAV_THEME = { light: {}, dark: {} };
export const withOpacity = () => '';
export const addOpacityToRgb = (rgb: string, opacity: number) =>
  rgb.replace('rgb(', 'rgba(').replace(')', `, ${opacity})`);

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
// @packrat/web-ui shadcn components — direct re-exports
// ---------------------------------------------------------------------------

// nativewindui Toggle is an on/off switch → shadcn Switch
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
  Switch as Toggle,
} from '@packrat/web-ui';

// ---------------------------------------------------------------------------
// Pass-through structural components
// ---------------------------------------------------------------------------

export const DrawerContentRoot = ({ children }: { children?: React.ReactNode }) => (
  <div>{children}</div>
);
export const DrawerContentSection = ({ children }: { children?: React.ReactNode }) => (
  <div>{children}</div>
);
export const DrawerContentSectionItem = () => null;
export const DrawerContentSectionTitle = () => null;
export const getActiveDrawerContentScreen = () => null;

export const Form = ({ children }: { children?: React.ReactNode }) => <form>{children}</form>;
export const FormItem = ({ children }: { children?: React.ReactNode }) => <div>{children}</div>;
export const FormSection = ({ children }: { children?: React.ReactNode }) => (
  <div className="mb-4">{children}</div>
);

export const Toolbar = ({ children }: { children?: React.ReactNode }) => (
  <div className="flex gap-2">{children}</div>
);
export const ToolbarCTA = () => null;
export const ToolbarIcon = () => null;

// Alert — renders children as a pass-through (button inside still works)
export const Alert = ({ children }: { children?: React.ReactNode }) => <>{children}</>;
export const AlertMethods = {};

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
export const createContextSubMenu = (subMenu: object, items: unknown[]) =>
  Object.assign(subMenu, { items });
export const createContextItem = (item: unknown) => item;
export const createDropdownSubMenu = (subMenu: object, items: unknown[]) =>
  Object.assign(subMenu, { items });
export const createDropdownItem = (item: unknown) => item;
