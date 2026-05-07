import { cn } from '@packrat/web-ui/lib/utils';
import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import type React from 'react';
import { Toaster } from 'trails-app/components/ui/sonner';
import { AuthProvider } from 'trails-app/lib/useAuth';
import './globals.css';

const inter = Inter({ subsets: ['latin'], variable: '--font-sans' });

export const metadata: Metadata = {
  title: 'Trail Search — PackRat',
  description: 'Discover hiking, cycling, and outdoor trails near you. Powered by PackRat.',
  keywords: ['trail search', 'hiking trails', 'outdoor trails', 'trail finder', 'PackRat'],
  openGraph: {
    type: 'website',
    title: 'Trail Search — PackRat',
    description: 'Discover hiking, cycling, and outdoor trails near you.',
    siteName: 'PackRat',
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className={cn('min-h-screen bg-background font-sans antialiased', inter.variable)}>
        <AuthProvider>
          {children}
          <Toaster />
        </AuthProvider>
      </body>
    </html>
  );
}
