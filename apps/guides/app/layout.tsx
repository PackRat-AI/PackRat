import Footer from 'guides-app/components/footer';
import Header from 'guides-app/components/header';
import { QueryProvider } from 'guides-app/components/providers/query-provider';
import { ThemeProvider } from 'guides-app/components/theme-provider';
import { cn } from 'guides-app/lib/utils';
import { Mona_Sans as FontSans } from 'next/font/google';
import type React from 'react';
import './globals.css';

const fontSans = FontSans({
  subsets: ['latin'],
  variable: '--font-sans',
  weight: ['400', '500', '600', '700'],
});

export const metadata = {
  title: 'PackRat Guides | Hiking & Outdoor Adventures',
  description: 'Expert hiking and outdoor guides to help you prepare for your next adventure',
  icons: {
    icon: '/PackRat.ico',
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
