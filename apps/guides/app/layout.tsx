import { cn } from '@packrat/web-ui/lib/utils';
import Footer from 'guides-app/components/footer';
import Header from 'guides-app/components/header';
import { QueryProvider } from 'guides-app/components/providers/query-provider';
import { ThemeProvider } from 'guides-app/components/theme-provider';
import { siteConfig } from 'guides-app/lib/config';
import type { Metadata } from 'next';
import { Mona_Sans as FontSans } from 'next/font/google';
import type React from 'react';
import './globals.css';

const fontSans = FontSans({
  subsets: ['latin'],
  variable: '--font-sans',
  weight: ['400', '500', '600', '700'],
});

export const metadata: Metadata = {
  title: {
    default: 'PackRat Guides | Hiking & Outdoor Adventures',
    template: '%s | PackRat Guides',
  },
  description: 'Expert hiking and outdoor guides to help you prepare for your next adventure',
  keywords: [
    'hiking guides',
    'outdoor adventures',
    'trail guides',
    'camping',
    'backpacking',
    'gear reviews',
    'wilderness skills',
    'outdoor planning',
  ],
  authors: [{ name: 'PackRat Team', url: 'https://packrat.world' }],
  creator: 'PackRat Team',
  metadataBase: new URL(siteConfig.url),
  openGraph: {
    type: 'website',
    locale: 'en_US',
    url: siteConfig.url,
    siteName: 'PackRat Guides',
    title: 'PackRat Guides | Hiking & Outdoor Adventures',
    description: 'Expert hiking and outdoor guides to help you prepare for your next adventure',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'PackRat Guides | Hiking & Outdoor Adventures',
    description: 'Expert hiking and outdoor guides to help you prepare for your next adventure',
    creator: '@packratai',
  },
  icons: {
    icon: [{ url: '/PackRatGuides.ico', type: 'image/x-icon' }],
    shortcut: '/favicon-16x16.png',
    apple: '/apple-touch-icon.png',
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={cn('min-h-screen bg-background font-sans antialiased', fontSans.variable)}>
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
          <QueryProvider>
            <div className="flex min-h-screen flex-col">
              <Header />
              <main className="flex-1">{children}</main>
              <Footer />
            </div>
          </QueryProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
