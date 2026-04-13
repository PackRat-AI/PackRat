import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
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

  // Always use Material icons on Android/Web, or when useMaterialIcon is true
  if (useMaterialIcon) {
    if (materialIcon?.type === 'MaterialCommunityIcons') {
      return (
        <MaterialCommunityIcons
          name={materialIcon.name ?? iconNames.materialCommunityIcon ?? 'help'}
          size={size}
          color={color}
          {...materialIcon}
        />
      );
    }
    if (materialIcon?.type === 'MaterialIcons') {
      return (
        <MaterialIcons
          name={materialIcon.name ?? iconNames.materialIcon ?? 'help'}
          size={size}
          color={color}
          {...materialIcon}
        />
      );
    }
  }

  if (!name) return null;

  const materialProps = materialIcon ?? {};

  // Prefer MaterialIcons if available, otherwise use MaterialCommunityIcons
  return iconNames.materialIcon ? (
    <MaterialIcons
      // @ts-expect-error when name is passed by `materialProps`, we want it to replace this icon name
      name={iconNames.materialIcon ?? 'help'}
      size={size}
      color={color}
      {...materialProps}
    />
  ) : (
    <MaterialCommunityIcons
      // @ts-expect-error when name is passed by `materialProps`, we want it to replace this icon name
      name={iconNames.materialCommunityIcon ?? 'help'}
      size={size}
      color={color}
      {...materialProps}
    />
  );
}

export { Icon };
