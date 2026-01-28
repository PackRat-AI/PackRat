// Color palette for theming
export const COLORS = {
  // Light theme colors
  light: {
    primary: '#18181b',
    primaryForeground: '#fafafa',
    secondary: '#f4f4f5',
    secondaryForeground: '#18181b',
    muted: '#f4f4f5',
    mutedForeground: '#71717a',
    background: '#fafafa',
    foreground: '#18181b',
    card: '#ffffff',
    cardForeground: '#18181b',
    border: '#e4e4e7',
    input: '#e4e4e7',
    destructive: '#ef4444',
    destructiveForeground: '#fef2f2',
    success: '#10b981',
    warning: '#f59e0b',
  },
  // Dark theme colors
  dark: {
    primary: '#fafafa',
    primaryForeground: '#18181b',
    secondary: '#27272a',
    secondaryForeground: '#fafafa',
    muted: '#27272a',
    mutedForeground: '#a1a1aa',
    background: '#09090b',
    foreground: '#fafafa',
    card: '#09090b',
    cardForeground: '#fafafa',
    border: '#27272a',
    input: '#27272a',
    destructive: '#7f1d1d',
    destructiveForeground: '#fafafa',
    success: '#10b981',
    warning: '#f59e0b',
  },
} as const;

export type ColorName = keyof typeof COLORS.light;
