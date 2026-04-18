import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { SymbolView } from 'expo-symbols';
import type { ComponentProps } from 'react';
import { useMemo } from 'react';
import { getIconNames } from './get-icon-names';
import type { IconProps } from './types';

function Icon({
  name,
  color = '#000000',
  namingScheme = 'material',
  size = 27,
  ios,
  materialIcon,
}: IconProps) {
  const { useMaterialIcon, ...sfSymbolProps } = ios ?? {};
  const iconNames = useMemo(() => getIconNames(namingScheme, name), [namingScheme, name]);

  // Use Material icons on iOS when useMaterialIcon is true
  if (useMaterialIcon) {
    const prefersMaterialIcons = materialIcon?.type === 'MaterialIcons';
    const prefersMaterialCommunityIcons = materialIcon?.type === 'MaterialCommunityIcons';

    if (prefersMaterialCommunityIcons) {
      const iconName = (materialIcon?.name ??
        iconNames.materialCommunityIcon ??
        'help') as ComponentProps<typeof MaterialCommunityIcons>['name'];
      const { type: _type, name: _name, ...restProps } = materialIcon || {};
      return <MaterialCommunityIcons {...restProps} name={iconName} size={size} color={color} />;
    }

    if (prefersMaterialIcons) {
      const iconName = (materialIcon?.name ?? iconNames.materialIcon ?? 'help') as ComponentProps<
        typeof MaterialIcons
      >['name'];
      const { type: _type, name: _name, ...restProps } = materialIcon || {};
      return <MaterialIcons {...restProps} name={iconName} size={size} color={color} />;
    }

    if (iconNames.materialIcon) {
      const iconName = (materialIcon?.name ?? iconNames.materialIcon ?? 'help') as ComponentProps<
        typeof MaterialIcons
      >['name'];
      const { type: _type, name: _name, ...restProps } = materialIcon || {};
      return <MaterialIcons {...restProps} name={iconName} size={size} color={color} />;
    }

    const iconName = (materialIcon?.name ??
      iconNames.materialCommunityIcon ??
      'help') as ComponentProps<typeof MaterialCommunityIcons>['name'];
    const { type: _type, name: _name, ...restProps } = materialIcon || {};
    return <MaterialCommunityIcons {...restProps} name={iconName} size={size} color={color} />;
  }

  // Default to SF Symbols on iOS, but fall back to Material icons if no mapping exists
  if (iconNames.sfSymbol) {
    return (
      <SymbolView
        size={size}
        scale="small"
        name={iconNames.sfSymbol}
        tintColor={color}
        {...sfSymbolProps}
      />
    );
  }

  // Fallback to Material icons when no SF Symbol mapping exists
  if (iconNames.materialIcon) {
    const iconName = (materialIcon?.name ?? iconNames.materialIcon ?? 'help') as ComponentProps<
      typeof MaterialIcons
    >['name'];
    const { type: _type, name: _name, ...restProps } = materialIcon || {};
    return <MaterialIcons {...restProps} name={iconName} size={size} color={color} />;
  }

  const iconName = (materialIcon?.name ??
    iconNames.materialCommunityIcon ??
    'help') as ComponentProps<typeof MaterialCommunityIcons>['name'];
  const { type: _type, name: _name, ...restProps } = materialIcon || {};
  return <MaterialCommunityIcons {...restProps} name={iconName} size={size} color={color} />;
}

export { Icon };
