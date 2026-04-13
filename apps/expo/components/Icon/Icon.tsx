import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import {
  SF_SYMBOLS_TO_MATERIAL_COMMUNITY_ICONS,
  SF_SYMBOLS_TO_MATERIAL_ICONS,
} from 'rn-icon-mapper';
import type { IconProps } from './types';

function Icon({
  name,
  materialCommunityIcon,
  materialIcon,
  sfSymbol: _sfSymbol,
  ...props
}: IconProps) {
  if (materialCommunityIcon) {
    return <MaterialCommunityIcons {...props} {...materialCommunityIcon} />;
  }
  if (materialIcon) {
    return <MaterialIcons {...props} {...materialIcon} />;
  }
  const materialCommunityIconName =
    SF_SYMBOLS_TO_MATERIAL_COMMUNITY_ICONS[
      name as keyof typeof SF_SYMBOLS_TO_MATERIAL_COMMUNITY_ICONS
    ];
  if (materialCommunityIconName) {
    return <MaterialCommunityIcons name={materialCommunityIconName} {...props} />;
  }
  const materialIconName =
    SF_SYMBOLS_TO_MATERIAL_ICONS[name as keyof typeof SF_SYMBOLS_TO_MATERIAL_ICONS];
  if (materialIconName) {
    return <MaterialIcons name={materialIconName} {...props} />;
  }
  return <MaterialCommunityIcons name="help" {...props} />;
}

export { Icon };
