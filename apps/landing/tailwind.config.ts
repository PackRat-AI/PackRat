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
      keyframes: {
        gradient: {
          '0%': { backgroundPosition: '0% 50%' },
          '50%': { backgroundPosition: '100% 50%' },
          '100%': { backgroundPosition: '0% 50%' },
        },
      },
      animation: {
        gradient: 'gradient 8s ease infinite',
      },
    },
  },
} satisfies Config;

export default config;
