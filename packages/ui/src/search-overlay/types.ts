import type { ReactNode } from 'react';

export interface SearchOverlayProps {
  placeholder?: string;
  value: string;
  onChangeText: (text: string) => void;
  children: ReactNode;
  /**
   * Android only — extra header-right content rendered before the search icon.
   * On iOS the parent Stack.Screen headerRight handles this; this prop is ignored.
   */
  androidHeaderRightActions?: ReactNode;
}
