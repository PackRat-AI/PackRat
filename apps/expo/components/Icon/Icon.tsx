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
  materialIcon,
}: IconProps) {
  const iconNames = useMemo(() => getIconNames(namingScheme, name), [namingScheme, name]);

  const materialProps = materialIcon ?? {};
  const prefersMaterialIcons = materialIcon?.type === 'MaterialIcons';
  const prefersMaterialCommunityIcons = materialIcon?.type === 'MaterialCommunityIcons';
  const materialIconName = materialProps.name ?? iconNames.materialIcon ?? 'help';
  const materialCommunityIconName = materialProps.name ?? iconNames.materialCommunityIcon ?? 'help';

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

  // Prefer MaterialIcons if available, otherwise use MaterialCommunityIcons
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
