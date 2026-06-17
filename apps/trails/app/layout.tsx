import { cn } from '@packrat/web-ui/lib/utils';
import { Inter } from 'next/font/google';
import type React from 'react';
import { Toaster } from 'trails-app/components/ui/sonner';
import { trailsMetadata } from 'trails-app/lib/metadata';
import { AuthProvider } from 'trails-app/lib/useAuth';
import './globals.css';

const inter = Inter({ subsets: ['latin'], variable: '--font-sans' });

export const metadata = trailsMetadata;

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
