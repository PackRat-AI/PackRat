import preset from '@packrat/web-ui/tailwind/preset';
import type { Config } from 'tailwindcss';

const config = {
  presets: [preset],
  content: [
    './pages/**/*.{ts,tsx}',
    './components/**/*.{ts,tsx}',
    './app/**/*.{ts,tsx}',
    './src/**/*.{ts,tsx}',
    '*.{js,ts,jsx,tsx,mdx}',
    '../../packages/web-ui/src/**/*.{ts,tsx}',
  ],
  theme: {
    extend: {
      typography: {
        DEFAULT: {
          css: {
            'code::before': {
              content: '""',
            },
            'code::after': {
              content: '""',
            },
            a: {
              color: '#007AFF',
              '&:hover': {
                color: '#0056b3',
              },
            },
            h1: {
              color: 'hsl(var(--foreground))',
              fontWeight: 600,
            },
            h2: {
              color: 'hsl(var(--foreground))',
              fontWeight: 600,
            },
            h3: {
              color: 'hsl(var(--foreground))',
              fontWeight: 600,
            },
            h4: {
              color: 'hsl(var(--foreground))',
              fontWeight: 600,
            },
          },
        },
      },
    },
  },
  plugins: [require('@tailwindcss/typography')],
} satisfies Config;

export default config;
