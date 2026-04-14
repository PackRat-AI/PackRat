import { cn } from '@packrat/web-ui/lib/utils';
import type { Metadata } from 'next';
import { Mona_Sans as FontSans } from 'next/font/google';
import type React from 'react';
import { ThemeProvider } from 'admin-app/components/theme-provider';
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
      <body className={cn('min-h-screen bg-background font-sans antialiased', fontSans.variable)}>
        <ThemeProvider attribute="class" defaultTheme="dark" enableSystem disableTransitionOnChange>
          {children}
        </ThemeProvider>
      </body>
    </html>
  );
}
