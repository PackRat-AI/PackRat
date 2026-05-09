import { cn } from '@packrat/web-ui/lib/utils';
import { QueryProvider } from 'admin-app/components/query-provider';
import { ThemeProvider } from 'admin-app/components/theme-provider';
import type { Metadata } from 'next';
import { Mona_Sans as FontSans } from 'next/font/google';
import { NuqsAdapter } from 'nuqs/adapters/next/app';
import type React from 'react';
import './globals.css';

const fontSans = FontSans({
  subsets: ['latin'],
  variable: '--font-sans',
  weight: ['400', '500', '600', '700'],
});

export const metadata: Metadata = {
  title: {
    default: 'PackRat Admin',
    template: '%s | PackRat Admin',
  },
  description: 'PackRat administration dashboard',
  robots: { index: false, follow: false },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        {/* Leaflet CSS loaded from CDN — the JS bundle uses webpack externals (window.L) */}
        <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
      </head>
      <body className={cn('min-h-screen bg-background font-sans antialiased', fontSans.variable)}>
        <NuqsAdapter>
          <QueryProvider>
            <ThemeProvider
              attribute="class"
              defaultTheme="dark"
              enableSystem
              disableTransitionOnChange
            >
              {children}
            </ThemeProvider>
          </QueryProvider>
        </NuqsAdapter>
      </body>
    </html>
  );
}
