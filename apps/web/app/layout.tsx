import type { Metadata, Viewport } from 'next';
import type React from 'react';
import './globals.css';
import { Providers } from 'web-app/components/providers';

export const metadata: Metadata = {
  title: 'PackRat — Ultralight Gear Planner',
  description:
    'AI-powered outdoor gear and trip planning app for ultralight enthusiasts. Build lighter packs, plan smarter trips.',
  keywords: ['ultralight', 'backpacking', 'gear', 'pack list', 'trip planning', 'AI'],
  icons: {
    icon: [
      { url: '/icon-light-32x32.png', media: '(prefers-color-scheme: light)' },
      { url: '/icon-dark-32x32.png', media: '(prefers-color-scheme: dark)' },
      { url: '/icon.svg', type: 'image/svg+xml' },
    ],
    apple: '/apple-icon.png',
  },
};

export const viewport: Viewport = {
  themeColor: '#000000',
  width: 'device-width',
  initialScale: 1,
  userScalable: false,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="bg-background" suppressHydrationWarning>
      <body className="font-sans antialiased">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
