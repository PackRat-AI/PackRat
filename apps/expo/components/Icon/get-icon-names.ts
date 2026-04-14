import {
  MATERIAL_COMMUNITY_ICONS_TO_SF_SYMBOLS,
  MATERIAL_ICONS_TO_SF_SYMBOLS,
  SF_SYMBOLS_TO_MATERIAL_COMMUNITY_ICONS,
  SF_SYMBOLS_TO_MATERIAL_ICONS,
} from 'rn-icon-mapper';
import type { MaterialCommunityIconsProps, MaterialIconsProps } from './types';

type IconMapping = {
  sfSymbol: string | null;
  materialIcon: MaterialIconsProps['name'] | null;
  materialCommunityIcon: MaterialCommunityIconsProps['name'] | null;
};

export function getIconNames(namingScheme: 'sfSymbol' | 'material', name?: string): IconMapping {
  if (!name) {
    return {
      sfSymbol: null,
      materialIcon: null,
      materialCommunityIcon: null,
    };
  }

  if (namingScheme === 'sfSymbol') {
    // Name is an SF Symbol, need to map to Material icons
    const materialCommunityIcon =
      SF_SYMBOLS_TO_MATERIAL_COMMUNITY_ICONS[
        name as keyof typeof SF_SYMBOLS_TO_MATERIAL_COMMUNITY_ICONS
      ];
    if (materialCommunityIcon) {
      return {
        sfSymbol: name,
        materialIcon: null,
        materialCommunityIcon,
      };
    }

    const materialIcon =
      SF_SYMBOLS_TO_MATERIAL_ICONS[name as keyof typeof SF_SYMBOLS_TO_MATERIAL_ICONS];
    if (materialIcon) {
      return {
        sfSymbol: name,
        materialIcon,
        materialCommunityIcon: null,
      };
    }

    // No mapping found for SF Symbol
    return {
      sfSymbol: name,
      materialIcon: null,
      materialCommunityIcon: null,
    };
  }

  // namingScheme is 'material', name is a Material icon
  // Try to find SF Symbol mapping for it
  const sfSymbolFromCommunity =
    MATERIAL_COMMUNITY_ICONS_TO_SF_SYMBOLS[
      name as keyof typeof MATERIAL_COMMUNITY_ICONS_TO_SF_SYMBOLS
    ];
  if (sfSymbolFromCommunity) {
    return {
      sfSymbol: sfSymbolFromCommunity,
      materialIcon: null,
      materialCommunityIcon: name as MaterialCommunityIconsProps['name'],
    };
  }

  const sfSymbolFromMaterial =
    MATERIAL_ICONS_TO_SF_SYMBOLS[name as keyof typeof MATERIAL_ICONS_TO_SF_SYMBOLS];
  if (sfSymbolFromMaterial) {
    return {
      sfSymbol: sfSymbolFromMaterial,
      materialIcon: name as MaterialIconsProps['name'],
      materialCommunityIcon: null,
    };
  }

  // No mapping found, assume it's a Material Community icon
  return {
    sfSymbol: null,
    materialIcon: null,
    materialCommunityIcon: name as MaterialCommunityIconsProps['name'],
  };
}
