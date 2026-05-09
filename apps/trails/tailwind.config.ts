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
} satisfies Config;

export default config;
