import { siteConfig } from 'guides-app/lib/config';
import type { Metadata } from 'next';
import { buildWebsiteSocialMetadata } from '../../shared/lib/og';

const socialMetadata = buildWebsiteSocialMetadata({
  siteUrl: siteConfig.url,
  siteName: 'PackRat Guides',
  title: 'PackRat Guides | Hiking & Outdoor Adventures',
  description: 'Expert hiking and outdoor guides to help you prepare for your next adventure',
  imagePath: '/og-image.png',
  twitterHandle: '@packratai',
});

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
  ...socialMetadata,
  icons: {
    icon: [{ url: '/PackRatGuides.ico', type: 'image/x-icon' }],
    shortcut: '/favicon-16x16.png',
    apple: '/apple-touch-icon.png',
  },
};
