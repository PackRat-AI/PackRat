import {
  MATERIAL_COMMUNITY_ICONS_TO_SF_SYMBOLS,
  MATERIAL_ICONS_TO_SF_SYMBOLS,
  SF_SYMBOLS_TO_MATERIAL_COMMUNITY_ICONS,
  SF_SYMBOLS_TO_MATERIAL_ICONS,
} from 'rn-icon-mapper';
import type { MaterialCommunityIconsProps, MaterialIconsProps, SfSymbolName } from './types';

type IconMapping = {
  sfSymbol: SfSymbolName | null;
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
        // safe-cast: caller passes name under sfSymbol naming scheme; SfSymbolName is a string
        // union from expo-symbols and cannot be checked without a full lookup table.
        sfSymbol: name as SfSymbolName,
        materialIcon: null,
        materialCommunityIcon,
      };
    }

    const materialIcon =
      SF_SYMBOLS_TO_MATERIAL_ICONS[name as keyof typeof SF_SYMBOLS_TO_MATERIAL_ICONS];
    if (materialIcon) {
      return {
        // safe-cast: same as above — sfSymbol naming scheme, string is a valid SF Symbol name
        sfSymbol: name as SfSymbolName,
        materialIcon,
        materialCommunityIcon: null,
      };
    }

    // No mapping found for SF Symbol
    return {
      // safe-cast: same as above — sfSymbol naming scheme, string is a valid SF Symbol name
      sfSymbol: name as SfSymbolName,
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
      // safe-cast: value comes from MATERIAL_COMMUNITY_ICONS_TO_SF_SYMBOLS lookup table,
      // which contains valid SF Symbol names; the full union is not statically checkable.
      sfSymbol: sfSymbolFromCommunity as SfSymbolName,
      materialIcon: null,
      // safe-cast: name is a key of the MaterialCommunityIcons lookup; string checked at call site
      materialCommunityIcon: name as MaterialCommunityIconsProps['name'],
    };
  }

  const sfSymbolFromMaterial =
    MATERIAL_ICONS_TO_SF_SYMBOLS[name as keyof typeof MATERIAL_ICONS_TO_SF_SYMBOLS];
  if (sfSymbolFromMaterial) {
    return {
      // safe-cast: value from MATERIAL_ICONS_TO_SF_SYMBOLS lookup; valid SF Symbol name
      sfSymbol: sfSymbolFromMaterial as SfSymbolName,
      // safe-cast: name is a key of the MaterialIcons lookup; string checked at call site
      materialIcon: name as MaterialIconsProps['name'],
      materialCommunityIcon: null,
    };
  }

  // No mapping found, assume it's a Material Community icon
  return {
    sfSymbol: null,
    materialIcon: null,
    // safe-cast: no mapping found; assume name is a MaterialCommunityIcons name as fallback
    materialCommunityIcon: name as MaterialCommunityIconsProps['name'],
  };
}
