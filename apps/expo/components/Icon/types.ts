import type { IconMapper } from 'rn-icon-mapper';
import type { SymbolViewProps } from 'expo-symbols';
import type MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import type MaterialIcons from '@expo/vector-icons/MaterialIcons';

type MaterialCommunityIconsProps = React.ComponentProps<typeof MaterialCommunityIcons>;
type MaterialIconsProps = React.ComponentProps<typeof MaterialIcons>;

export type IconProps = IconMapper<
  SymbolViewProps,
  MaterialIconsProps,
  MaterialCommunityIconsProps
>;

// Legacy types for backward compatibility
export type MaterialIconName = React.ComponentProps<typeof MaterialCommunityIcons>['name'];
export type SfSymbolName = SymbolViewProps['name'];
