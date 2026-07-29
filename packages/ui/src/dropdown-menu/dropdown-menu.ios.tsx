import { View } from 'react-native';
import {
  ContextMenuButton,
  type MenuAttributes,
  type MenuConfig,
  type MenuElementConfig,
  type OnPressMenuItemEvent,
  // @ts-expect-error - https://github.com/dominicstop/react-native-ios-context-menu/issues/129
} from 'react-native-ios-context-menu';
import type { DropdownItem, DropdownMenuConfig, DropdownMenuProps, DropdownSubMenu } from './types';

// Plain RN composition — DropdownMenu never needed a Host bridge on iOS either, it already
// wrapped react-native-ios-context-menu (a real, unmodified third-party native library, not
// @expo/ui). Ported directly.

function DropdownMenu({
  ref,
  items,
  title,
  iOSItemSize = 'large',
  onItemPress,
  enabled = true,
  materialPortalHost: _materialPortalHost,
  materialSideOffset: _materialSideOffset,
  materialAlignOffset: _materialAlignOffset,
  materialAlign: _materialAlign,
  materialWidth: _materialWidth,
  materialMinWidth: _materialMinWidth,
  materialLoadingText: _materialLoadingText,
  materialSubMenuTitlePlaceholder: _materialSubMenuTitlePlaceholder,
  materialOverlayClassName: _materialOverlayClassName,
  ...props
}: DropdownMenuProps) {
  return (
    <View>
      <ContextMenuButton
        ref={ref as React.LegacyRef<ContextMenuButton>}
        isMenuPrimaryAction
        isContextMenuEnabled={enabled}
        menuConfig={toConfigMenu({ items, iOSItemSize, title })}
        onPressMenuItem={toOnPressMenuItem(onItemPress)}
        {...props}
      />
    </View>
  );
}

export { DropdownMenu };

// react-native-ios-context-menu ships no .d.ts files at all (see the @ts-expect-error import
// above — https://github.com/dominicstop/react-native-ios-context-menu/issues/129), so
// OnPressMenuItemEvent's own nativeEvent param has no usable type. Declared locally from the
// library's documented native event payload shape, matching the properties actually read below.
type ContextMenuNativeEvent = {
  actionKey: string;
  actionTitle?: string;
  actionSubtitle?: string;
  menuState?: 'on' | 'off' | 'mixed';
  menuAttributes?: string[];
};

function toOnPressMenuItem(onItemPress: DropdownMenuProps['onItemPress']): OnPressMenuItemEvent {
  return ({ nativeEvent }: { nativeEvent: ContextMenuNativeEvent }) => {
    onItemPress?.({
      actionKey: nativeEvent.actionKey,
      title: nativeEvent.actionTitle,
      subTitle: nativeEvent.actionSubtitle,
      state: nativeEvent.menuState ? { checked: nativeEvent.menuState === 'on' } : undefined,
      destructive: nativeEvent.menuAttributes?.includes('destructive'),
      disabled: nativeEvent.menuAttributes?.includes('disabled'),
      hidden: nativeEvent.menuAttributes?.includes('hidden'),
      keepOpenOnPress: nativeEvent.menuAttributes?.includes('keepsMenuPresented'),
      loading: false,
    });
  };
}

function toConfigMenu({
  items,
  iOSItemSize,
  title,
}: Pick<DropdownMenuConfig, 'items' | 'iOSItemSize' | 'title'>): MenuConfig {
  return {
    menuTitle: title ?? '',
    menuPreferredElementSize: iOSItemSize,
    menuItems: items.map((item) => ('items' in item ? toConfigSubMenu(item) : toConfigItem(item))),
  };
}

function toConfigSubMenu(subMenu: DropdownSubMenu): MenuElementConfig {
  if (subMenu.loading) {
    return { type: 'deferred', deferredID: `${subMenu.title ?? ''}-${Date.now()}` };
  }
  return {
    menuOptions: subMenu.iOSType === 'inline' ? ['displayInline'] : undefined,
    menuTitle: subMenu.title ?? '',
    menuSubtitle: subMenu.subTitle,
    menuPreferredElementSize: subMenu.iOSItemSize,
    menuItems: subMenu.items.map((item) =>
      'items' in item ? toConfigSubMenu(item) : toConfigItem(item),
    ),
  };
}

function toConfigItem(item: DropdownItem): MenuElementConfig {
  if (item.loading) {
    return { type: 'deferred', deferredID: `${item.actionKey}-deferred}` };
  }
  const menuAttributes: MenuAttributes[] = [];
  if (item.destructive) menuAttributes.push('destructive');
  if (item.disabled) menuAttributes.push('disabled');
  if (item.hidden) menuAttributes.push('hidden');
  if (item.keepOpenOnPress) menuAttributes.push('keepsMenuPresented');
  return {
    actionKey: item.actionKey,
    actionTitle: item.title ?? '',
    actionSubtitle: item.subTitle,
    menuState: item.state?.checked ? 'on' : 'off',
    menuAttributes,
    discoverabilityTitle: item.subTitle,
    icon: item?.image?.url
      ? {
          type: 'IMAGE_REMOTE_URL',
          imageValue: { url: item.image.url },
          imageOptions: { cornerRadius: item.image.cornerRadius, tint: item.image.tint },
        }
      : item.icon
        ? { iconType: 'SYSTEM', iconValue: item.icon.name, iconTint: item.icon.color }
        : undefined,
  };
}
