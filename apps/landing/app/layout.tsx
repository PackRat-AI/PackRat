import { cn } from '@packrat/web-ui/lib/utils';
import MainNav from 'landing-app/components/main-nav';
import SiteFooter from 'landing-app/components/site-footer';
import { ThemeProvider } from 'landing-app/components/theme-provider';
import { landingMetadata } from 'landing-app/lib/metadata';
import { Mona_Sans as FontSans } from 'next/font/google';
import type React from 'react';
import './globals.css';

const fontSans = FontSans({
  subsets: ['latin'],
  variable: '--font-sans',
  weight: ['400', '500', '600', '700'],
});

export const metadata = landingMetadata;

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={cn('min-h-screen bg-background font-sans antialiased', fontSans.variable)}>
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          <div className="flex min-h-screen flex-col">
            <MainNav />
            {children}
            <SiteFooter />
          </div>
        </ThemeProvider>
      </body>
    </html>
  );
}
