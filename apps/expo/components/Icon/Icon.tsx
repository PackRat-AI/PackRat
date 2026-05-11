import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import type { ComponentProps } from 'react';
import { useMemo } from 'react';
import { getIconNames } from './get-icon-names';
import type { IconProps } from './types';

function Icon({
  name,
  color = '#000000',
  namingScheme = 'material',
  size = 27,
  materialIcon,
}: IconProps) {
  const iconNames = useMemo(() => getIconNames(namingScheme, name), [namingScheme, name]);

  const prefersMaterialIcons = materialIcon?.type === 'MaterialIcons';
  const prefersMaterialCommunityIcons = materialIcon?.type === 'MaterialCommunityIcons';

  if (prefersMaterialCommunityIcons) {
    // safe-cast: string fallback chain produces a valid MaterialCommunityIcons name at runtime;
    // the icon name union is too wide for TypeScript to verify statically.
    const iconName = (materialIcon?.name ??
      iconNames.materialCommunityIcon ??
      'help') as ComponentProps<typeof MaterialCommunityIcons>['name'];
    const { type: _type, name: _name, ...restProps } = materialIcon || {};
    return <MaterialCommunityIcons {...restProps} name={iconName} size={size} color={color} />;
  }

  if (prefersMaterialIcons) {
    // safe-cast: string fallback chain produces a valid MaterialIcons name at runtime;
    // the icon name union is too wide for TypeScript to verify statically.
    const iconName = (materialIcon?.name ?? iconNames.materialIcon ?? 'help') as ComponentProps<
      typeof MaterialIcons
    >['name'];
    const { type: _type, name: _name, ...restProps } = materialIcon || {};
    return <MaterialIcons {...restProps} name={iconName} size={size} color={color} />;
  }

  // Prefer MaterialIcons if available, otherwise use MaterialCommunityIcons
  if (iconNames.materialIcon) {
    // safe-cast: string fallback chain produces a valid MaterialIcons name at runtime;
    // the icon name union is too wide for TypeScript to verify statically.
    const iconName = (materialIcon?.name ?? iconNames.materialIcon ?? 'help') as ComponentProps<
      typeof MaterialIcons
    >['name'];
    const { type: _type, name: _name, ...restProps } = materialIcon || {};
    return <MaterialIcons {...restProps} name={iconName} size={size} color={color} />;
  }

  // safe-cast: string fallback chain produces a valid MaterialCommunityIcons name at runtime;
  // the icon name union is too wide for TypeScript to verify statically.
  const iconName = (materialIcon?.name ??
    iconNames.materialCommunityIcon ??
    'help') as ComponentProps<typeof MaterialCommunityIcons>['name'];
  const { type: _type, name: _name, ...restProps } = materialIcon || {};
  return <MaterialCommunityIcons {...restProps} name={iconName} size={size} color={color} />;
}

export { Icon };
