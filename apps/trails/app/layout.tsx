import { cn } from '@packrat/web-ui/lib/utils';
import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import type React from 'react';
import { Toaster } from 'trails-app/components/ui/sonner';
import { AuthProvider } from 'trails-app/lib/useAuth';
import './globals.css';

const inter = Inter({ subsets: ['latin'], variable: '--font-sans' });

const SITE_URL = 'https://trails.packratai.com';
const OG_IMAGE_URL = `${SITE_URL}/og-image.png`;

export const metadata: Metadata = {
  title: 'Trail Search — PackRat',
  description: 'Discover hiking, cycling, and outdoor trails near you. Powered by PackRat.',
  keywords: ['trail search', 'hiking trails', 'outdoor trails', 'trail finder', 'PackRat'],
  metadataBase: new URL(SITE_URL),
  openGraph: {
    type: 'website',
    url: SITE_URL,
    title: 'Trail Search — PackRat',
    description: 'Discover hiking, cycling, and outdoor trails near you.',
    siteName: 'PackRat',
    images: [{ url: OG_IMAGE_URL, width: 1200, height: 630, alt: 'Trail Search — PackRat' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Trail Search — PackRat',
    description: 'Discover hiking, cycling, and outdoor trails near you.',
    creator: '@packratai',
    images: [OG_IMAGE_URL],
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
