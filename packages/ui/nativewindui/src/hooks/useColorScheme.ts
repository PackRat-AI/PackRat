import { useColorScheme as useNativewindColorScheme } from 'nativewind';

export function useColorScheme() {
  const { colorScheme } = useNativewindColorScheme();
  return {
    dark: colorScheme === 'dark',
    light: colorScheme === 'light',
    colors: {
      background: colorScheme === 'dark' ? '#09090b' : '#fafafa',
      foreground: colorScheme === 'dark' ? '#fafafa' : '#09090b',
      primary: colorScheme === 'dark' ? '#fafafa' : '#18181b',
      'primary-foreground': colorScheme === 'dark' ? '#18181b' : '#fafafa',
      secondary: colorScheme === 'dark' ? '#27272a' : '#f4f4f5',
      'secondary-foreground': colorScheme === 'dark' ? '#fafafa' : '#18181b',
      muted: colorScheme === 'dark' ? '#27272a' : '#f4f4f5',
      'muted-foreground': colorScheme === 'dark' ? '#a1a1aa' : '#71717a',
      accent: colorScheme === 'dark' ? '#27272a' : '#f4f4f5',
      'accent-foreground': colorScheme === 'dark' ? '#fafafa' : '#18181b',
      destructive: colorScheme === 'dark' ? '#7f1d1d' : '#fef2f2',
      'destructive-foreground': colorScheme === 'dark' ? '#fafafa' : '#991b1b',
      border: colorScheme === 'dark' ? '#27272a' : '#e4e4e7',
      input: colorScheme === 'dark' ? '#27272a' : '#e4e4e7',
      ring: colorScheme === 'dark' ? '#d4d4d8' : '#18181b',
      background: colorScheme === 'dark' ? '#09090b' : '#ffffff',
      card: colorScheme === 'dark' ? '#09090b' : '#ffffff',
      'card-foreground': colorScheme === 'dark' ? '#fafafa' : '#09090b',
    },
  };
}
