import { siteConfig } from 'landing-app/config/site';
import type { Metadata } from 'next';
import { buildWebsiteSocialMetadata } from '../../shared/lib/og';

const socialMetadata = buildWebsiteSocialMetadata({
  siteUrl: siteConfig.url,
  siteName: siteConfig.name,
  title: siteConfig.name,
  description: siteConfig.description,
  imagePath: '/og-image.png',
  twitterHandle: siteConfig.twitterHandle,
});

export const landingMetadata: Metadata = {
  title: {
    default: siteConfig.name,
    template: `%s | ${siteConfig.name}`,
  },
  description: siteConfig.description,
  keywords: siteConfig.keywords,
  authors: [{ name: siteConfig.author, url: siteConfig.url }],
  creator: siteConfig.author,
  ...socialMetadata,
  icons: {
    icon: '/PackRat.ico',
    shortcut: '/favicon-16x16.png',
    apple: '/apple-touch-icon.png',
  },
  manifest: `${siteConfig.url}/site.webmanifest`,
};
