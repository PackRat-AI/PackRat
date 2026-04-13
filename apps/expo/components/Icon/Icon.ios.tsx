import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { SymbolView } from 'expo-symbols';
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
    const materialProps = materialIcon ?? {};
    const prefersMaterialIcons = materialIcon?.type === 'MaterialIcons';
    const prefersMaterialCommunityIcons = materialIcon?.type === 'MaterialCommunityIcons';
    const materialIconName = materialProps.name ?? iconNames.materialIcon ?? 'help';
    const materialCommunityIconName =
      materialProps.name ?? iconNames.materialCommunityIcon ?? 'help';

    if (prefersMaterialCommunityIcons) {
      return (
        <MaterialCommunityIcons
          {...materialProps}
          name={materialCommunityIconName}
          size={size}
          color={color}
        />
      );
    }

    if (prefersMaterialIcons) {
      return <MaterialIcons {...materialProps} name={materialIconName} size={size} color={color} />;
    }

    return iconNames.materialIcon ? (
      <MaterialIcons {...materialProps} name={materialIconName} size={size} color={color} />
    ) : (
      <MaterialCommunityIcons
        {...materialProps}
        name={materialCommunityIconName}
        size={size}
        color={color}
      />
    );
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
  const materialProps = materialIcon ?? {};
  const materialIconName = materialProps.name ?? iconNames.materialIcon ?? 'help';
  const materialCommunityIconName = materialProps.name ?? iconNames.materialCommunityIcon ?? 'help';

  return iconNames.materialIcon ? (
    <MaterialIcons {...materialProps} name={materialIconName} size={size} color={color} />
  ) : (
    <MaterialCommunityIcons
      {...materialProps}
      name={materialCommunityIconName}
      size={size}
      color={color}
    />
  );
}

export { Icon };
