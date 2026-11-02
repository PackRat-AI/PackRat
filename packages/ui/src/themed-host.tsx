import { Host, type HostProps, type MaterialColors } from '@expo/ui/jetpack-compose';
import { useColorScheme } from 'expo-app/lib/hooks/useColorScheme';

/**
 * The app's Material 3 scheme (SchemeFidelity, seed #0070E9) as Compose colour roles; the same
 * scheme the `--android-*` tokens in `apps/expo/global.css` map onto.
 */
const MATERIAL_COLORS: Readonly<Record<'light' | 'dark', MaterialColors>> = Object.freeze({
  light: {
    primary: '#0058BAFF',
    onPrimary: '#FFFFFFFF',
    primaryContainer: '#0070E9FF',
    onPrimaryContainer: '#FDFBFFFF',
    inversePrimary: '#ADC7FFFF',
    secondary: '#455E8FFF',
    onSecondary: '#FFFFFFFF',
    secondaryContainer: '#ADC7FEFF',
    onSecondaryContainer: '#395282FF',
    tertiary: '#9D3D00FF',
    onTertiary: '#FFFFFFFF',
    tertiaryContainer: '#C54F01FF',
    onTertiaryContainer: '#FFFAFFFF',
    background: '#F9F9FFFF',
    onBackground: '#181C23FF',
    surface: '#F9F9FFFF',
    onSurface: '#181C23FF',
    surfaceVariant: '#DDE2F3FF',
    onSurfaceVariant: '#414754FF',
    surfaceTint: '#005BBFFF',
    inverseSurface: '#2D3038FF',
    inverseOnSurface: '#EFF0FBFF',
    error: '#BA1A1AFF',
    onError: '#FFFFFFFF',
    errorContainer: '#FFDAD6FF',
    onErrorContainer: '#93000AFF',
    outline: '#727785FF',
    outlineVariant: '#C1C6D6FF',
    scrim: '#000000FF',
    surfaceBright: '#F9F9FFFF',
    surfaceDim: '#D8D9E4FF',
    surfaceContainer: '#ECEDF8FF',
    surfaceContainerHigh: '#E6E8F2FF',
    surfaceContainerHighest: '#E0E2ECFF',
    surfaceContainerLow: '#F2F3FEFF',
    surfaceContainerLowest: '#FFFFFFFF',
    primaryFixed: '#D8E2FFFF',
    primaryFixedDim: '#ADC7FFFF',
    onPrimaryFixed: '#001A41FF',
    onPrimaryFixedVariant: '#004493FF',
    secondaryFixed: '#D8E2FFFF',
    secondaryFixedDim: '#ADC7FEFF',
    onSecondaryFixed: '#001A41FF',
    onSecondaryFixedVariant: '#2C4675FF',
    tertiaryFixed: '#FFDBCCFF',
    tertiaryFixedDim: '#FFB695FF',
    onTertiaryFixed: '#351000FF',
    onTertiaryFixedVariant: '#7B2F00FF',
  },
  dark: {
    primary: '#ADC7FFFF',
    onPrimary: '#002E68FF',
    primaryContainer: '#0070E9FF',
    onPrimaryContainer: '#FDFBFFFF',
    inversePrimary: '#005BBFFF',
    secondary: '#ADC7FEFF',
    onSecondary: '#122F5DFF',
    secondaryContainer: '#2F4978FF',
    onSecondaryContainer: '#9FB8EFFF',
    tertiary: '#FFB695FF',
    onTertiary: '#571F00FF',
    tertiaryContainer: '#C54F01FF',
    onTertiaryContainer: '#FFFAFFFF',
    background: '#10131AFF',
    onBackground: '#E0E2ECFF',
    surface: '#10131AFF',
    onSurface: '#E0E2ECFF',
    surfaceVariant: '#414754FF',
    onSurfaceVariant: '#C1C6D6FF',
    surfaceTint: '#ADC7FFFF',
    inverseSurface: '#E0E2ECFF',
    inverseOnSurface: '#2D3038FF',
    error: '#FFB4ABFF',
    onError: '#690005FF',
    errorContainer: '#93000AFF',
    onErrorContainer: '#FFDAD6FF',
    outline: '#8B90A0FF',
    outlineVariant: '#414754FF',
    scrim: '#000000FF',
    surfaceBright: '#363941FF',
    surfaceDim: '#10131AFF',
    surfaceContainer: '#1C2027FF',
    surfaceContainerHigh: '#272A32FF',
    surfaceContainerHighest: '#32353DFF',
    surfaceContainerLow: '#181C23FF',
    surfaceContainerLowest: '#0B0E15FF',
    primaryFixed: '#D8E2FFFF',
    primaryFixedDim: '#ADC7FFFF',
    onPrimaryFixed: '#001A41FF',
    onPrimaryFixedVariant: '#004493FF',
    secondaryFixed: '#D8E2FFFF',
    secondaryFixedDim: '#ADC7FEFF',
    onSecondaryFixed: '#001A41FF',
    onSecondaryFixedVariant: '#2C4675FF',
    tertiaryFixed: '#FFDBCCFF',
    tertiaryFixedDim: '#FFB695FF',
    onTertiaryFixed: '#351000FF',
    onTertiaryFixedVariant: '#7B2F00FF',
  },
} as const);

/**
 * A Compose `Host` themed by the app rather than the device. A bare `Host` follows the system's
 * light/dark setting and Material You wallpaper colours, so with the app in dark mode on a phone
 * set to light, Compose content painted light-theme colours (unselected segment labels near-black
 * on a dark surface). Every Compose surface goes through this so it matches the RN screens.
 */
function ThemedHost(props: HostProps) {
  const { colorScheme } = useColorScheme();
  // Keyed by scheme: the native Host keeps the palette it mounted with, so switching the app to
  // dark left Compose content on the light roles until it remounted.
  return (
    <Host
      key={colorScheme}
      colorScheme={colorScheme}
      colorOverrides={MATERIAL_COLORS[colorScheme]}
      {...props}
    />
  );
}

export { ThemedHost };
