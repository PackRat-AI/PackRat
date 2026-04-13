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
  // Auto-detect SF Symbols: if the name contains a dot, it's likely an SF Symbol
  const effectiveNamingScheme = useMemo(() => {
    if (namingScheme !== 'material') return namingScheme;
    if (name && name.includes('.')) return 'sfSymbol';
    return 'material';
  }, [namingScheme, name]);

  const iconNames = useMemo(
    () => getIconNames(effectiveNamingScheme, name),
    [effectiveNamingScheme, name],
  );
  const { useMaterialIcon, ...sfSymbolProps } = ios ?? {};

  // Use Material icons on iOS when useMaterialIcon is true
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
    if (!name) return null;

    const materialProps = materialIcon ?? {};
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

  // Default to SF Symbols on iOS
  return (
    <SymbolView
      size={size}
      scale="small"
      name={iconNames.sfSymbol ?? 'questionmark'}
      tintColor={color}
      {...sfSymbolProps}
    />
  );
}

export { Icon };
