import { cn } from '@packrat/web-ui/lib/utils';
import Footer from 'guides-app/components/footer';
import Header from 'guides-app/components/header';
import { QueryProvider } from 'guides-app/components/providers/query-provider';
import { ThemeProvider } from 'guides-app/components/theme-provider';
import { guidesMetadata } from 'guides-app/lib/metadata';
import localFont from 'next/font/local';
import type React from 'react';
import './globals.css';

const fontSans = localFont({
  src: './fonts/mona-sans-latin.woff2',
  variable: '--font-sans',
  weight: '400 700',
});

export const metadata = guidesMetadata;

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
