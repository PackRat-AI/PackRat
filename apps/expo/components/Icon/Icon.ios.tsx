import { SymbolView } from 'expo-symbols';
import type { SfSymbols } from 'rn-icon-mapper';
import type { IconProps } from './types';

function Icon({
  materialCommunityIcon: _materialCommunityIcon,
  materialIcon: _materialIcon,
  sfSymbol,
  name,
  color,
  ...props
}: IconProps) {
  return (
    <SymbolView
      name={(name as SfSymbols) ?? 'questionmark'}
      tintColor={color ?? 'black'}
      {...props}
      {...sfSymbol}
    />
  );
}

export { Icon };
