import { siteConfig } from 'guides-app/lib/config';
import type { Metadata } from 'next';

export const guidesMetadata: Metadata = {
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
    images: [
      {
        url: new URL('/og-image.png', siteConfig.url).toString(),
        width: 1200,
        height: 630,
        alt: 'PackRat Guides | Hiking & Outdoor Adventures',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'PackRat Guides | Hiking & Outdoor Adventures',
    description: 'Expert hiking and outdoor guides to help you prepare for your next adventure',
    creator: '@packratai',
    images: [new URL('/og-image.png', siteConfig.url).toString()],
  },
  icons: {
    icon: [{ url: '/PackRatGuides.ico', type: 'image/x-icon' }],
    shortcut: '/favicon-16x16.png',
    apple: '/apple-touch-icon.png',
  },
};
