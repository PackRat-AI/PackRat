import { SidebarInset, SidebarProvider } from '@packrat/web-ui/components/sidebar';
import { cn } from '@packrat/web-ui/lib/utils';
import { AppSidebar } from 'admin-app/components/app-sidebar';
import { ThemeProvider } from 'admin-app/components/theme-provider';
import { ReactQueryProvider } from 'admin-app/lib/query-client';
import type { Metadata } from 'next';
import { Inter as FontSans } from 'next/font/google';
import type React from 'react';
import './globals.css';

const fontSans = FontSans({
  subsets: ['latin'],
  variable: '--font-sans',
});

export const metadata: Metadata = {
  title: {
    default: 'PackRat Admin',
    template: '%s | PackRat Admin',
  },
  description: 'PackRat internal admin dashboard',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={cn('min-h-screen bg-background font-sans antialiased', fontSans.variable)}>
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
          <ReactQueryProvider>
            <SidebarProvider>
              <AppSidebar />
              <SidebarInset>
                {children}
              </SidebarInset>
            </SidebarProvider>
          </ReactQueryProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
