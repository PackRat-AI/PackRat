import { useColorScheme as useNativewindColorScheme } from 'nativewind';

export const STUB_COLORS = {
  white: 'rgb(255, 255, 255)',
  black: 'rgb(0, 0, 0)',
  grey6: 'rgb(242, 242, 247)',
  grey5: 'rgb(230, 230, 235)',
  grey4: 'rgb(210, 210, 215)',
  grey3: 'rgb(199, 199, 204)',
  grey2: 'rgb(175, 176, 180)',
  grey: 'rgb(142, 142, 147)',
  background: 'rgb(255, 255, 255)',
  foreground: 'rgb(0, 0, 0)',
  root: 'rgb(255, 255, 255)',
  card: 'rgb(255, 255, 255)',
  cardForeground: 'rgb(8, 28, 30)',
  popover: 'rgb(230, 230, 235)',
  popoverForeground: 'rgb(0, 0, 0)',
  destructive: 'rgb(255, 56, 43)',
  primary: 'rgb(0, 123, 254)',
  primaryForeground: 'rgb(255, 255, 255)',
  secondary: 'rgb(45, 175, 231)',
  secondaryForeground: 'rgb(255, 255, 255)',
  muted: 'rgb(175, 176, 180)',
  mutedForeground: 'rgb(142, 142, 147)',
  accent: 'rgb(255, 40, 84)',
  accentForeground: 'rgb(255, 255, 255)',
  border: 'rgb(230, 230, 235)',
  input: 'rgb(210, 210, 215)',
  notification: 'rgb(255, 56, 43)',
};

export const DARK_STUB_COLORS = {
  ...STUB_COLORS,
  background: 'rgb(0, 0, 0)',
  foreground: 'rgb(255, 255, 255)',
  root: 'rgb(0, 0, 0)',
  card: 'rgb(18, 18, 18)',
  cardForeground: 'rgb(255, 255, 255)',
  grey6: 'rgb(28, 28, 30)',
  grey5: 'rgb(44, 44, 46)',
  grey4: 'rgb(58, 58, 60)',
  grey3: 'rgb(72, 72, 74)',
  grey2: 'rgb(99, 99, 102)',
  grey: 'rgb(142, 142, 147)',
};

export const COLORS = { light: STUB_COLORS, dark: DARK_STUB_COLORS };
export const NAV_THEME = { light: {}, dark: {} };
export const withOpacity = () => '';
export const addOpacityToRgb = (rgb: string, opacity: number) =>
  rgb.replace('rgb(', 'rgba(').replace(')', `, ${opacity})`);

export function useColorScheme() {
  const { colorScheme, setColorScheme } = useNativewindColorScheme();
  const scheme = colorScheme ?? 'light';

  return {
    colorScheme: scheme,
    isDarkColorScheme: scheme === 'dark',
    setColorScheme,
    toggleColorScheme: () => setColorScheme(scheme === 'light' ? 'dark' : 'light'),
    colors: scheme === 'dark' ? DARK_STUB_COLORS : STUB_COLORS,
  };
}
