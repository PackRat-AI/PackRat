import type { View, ViewProps } from 'react-native';

type DropdownIcon = { name: string; color?: string };

type DropdownItem = {
  actionKey: string;
  title?: string;
  subTitle?: string;
  state?: { checked: boolean };
  keepOpenOnPress?: boolean;
  // iOS 14 and above
  loading?: boolean;
  destructive?: boolean;
  disabled?: boolean;
  hidden?: boolean;
  // icon or image, not both — image has higher priority
  icon?: DropdownIcon;
  image?: { url?: string; cornerRadius?: number; tint?: string };
};

type DropdownSubMenuDropdown = {
  iOSType?: 'dropdown';
  iOSItemSize?: 'large';
  destructive?: boolean;
};

type DropdownSubMenuInline = {
  iOSType: 'inline';
  iOSItemSize?: 'small' | 'medium';
};

type DropdownSubMenu = (DropdownSubMenuDropdown | DropdownSubMenuInline) & {
  title: string;
  subTitle?: string;
  loading?: boolean;
  items: (DropdownItem | DropdownSubMenu)[];
};

type DropdownMenuConfig = {
  title?: string;
  items: (DropdownItem | DropdownSubMenu)[];
  iOSItemSize?: 'small' | 'medium' | 'large';
};

type DropdownMenuMethods = View & {
  presentMenu?: () => void;
  dismissMenu?: () => void;
};

type DropdownMenuProps = DropdownMenuConfig &
  ViewProps & {
    ref?: React.Ref<DropdownMenuMethods>;
    children: React.ReactNode;
    onItemPress?: (item: Omit<DropdownItem, 'icon'>) => void;
    enabled?: boolean;
    materialPortalHost?: string;
    materialSideOffset?: number;
    materialAlignOffset?: number;
    materialAlign?: 'start' | 'center' | 'end';
    materialWidth?: number;
    materialMinWidth?: number;
    materialLoadingText?: string;
    materialSubMenuTitlePlaceholder?: string;
    materialOverlayClassName?: string;
  };

export type {
  DropdownMenuProps,
  DropdownMenuConfig,
  DropdownSubMenu,
  DropdownItem,
  DropdownMenuMethods,
};
