import { OG_IMAGE_SIZE } from 'trails-app/lib/og-image';
import type { Metadata } from 'next';

export const SITE_URL = 'https://trails.packratai.com';
export const OG_IMAGE_URL = `${SITE_URL}/og-image.png`;

export const trailsMetadata: Metadata = {
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
    images: [
      {
        url: OG_IMAGE_URL,
        width: OG_IMAGE_SIZE.width,
        height: OG_IMAGE_SIZE.height,
        alt: 'Trail Search — PackRat',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Trail Search — PackRat',
    description: 'Discover hiking, cycling, and outdoor trails near you.',
    creator: '@packratai',
    images: [OG_IMAGE_URL],
  },
};
