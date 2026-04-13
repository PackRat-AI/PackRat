import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import type { SymbolViewProps } from 'expo-symbols';
import type { ComponentProps } from 'react';

export type MaterialCommunityIconsProps = ComponentProps<typeof MaterialCommunityIcons>;
export type MaterialIconsProps = ComponentProps<typeof MaterialIcons>;

type MaterialProps =
  | ({ type: 'MaterialCommunityIcons' } & MaterialCommunityIconsProps)
  | ({ type: 'MaterialIcons' } & MaterialIconsProps);

type OptionalMaterialProps =
  | ({ type?: 'MaterialCommunityIcons' } & Partial<MaterialCommunityIconsProps>)
  | ({ type?: 'MaterialIcons' } & Partial<MaterialIconsProps>);

type IOSProps = { useMaterialIcon: true } | ({ useMaterialIcon?: false } & SymbolViewProps);

type OptionalIOSProps = { useMaterialIcon?: boolean } & Partial<SymbolViewProps>;

type IconBaseProps = {
  namingScheme?: 'material' | 'sfSymbol';
  color?: string;
  size?: number;
  ios?: OptionalIOSProps;
  materialIcon?: OptionalMaterialProps;
};

type IconWithNameProps = {
  name: string;
} & IconBaseProps;

type IconWithOptionalNameProps = {
  name?: string;
  ios: IOSProps;
  materialIcon: MaterialProps;
} & Omit<IconBaseProps, 'ios' | 'materialIcon'>;

export type IconProps = IconWithNameProps | IconWithOptionalNameProps;

// Legacy types for backward compatibility
export type MaterialIconName = MaterialCommunityIconsProps['name'];
export type SfSymbolName = SymbolViewProps['name'];
