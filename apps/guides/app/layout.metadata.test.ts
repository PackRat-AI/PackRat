import { describe, expect, it } from 'vitest';
import { siteConfig } from '../lib/config';
import { guidesMetadata as metadata } from './metadata';

describe('guides metadata', () => {
  it('includes absolute Open Graph and Twitter image URLs', () => {
    const expectedImageUrl = new URL('/opengraph-image.png', siteConfig.url).toString();

    expect(metadata.openGraph?.images).toEqual([
      {
        url: expectedImageUrl,
        width: 1200,
        height: 630,
        alt: 'PackRat Guides | Hiking & Outdoor Adventures',
      },
    ]);

    expect(metadata.twitter?.images).toEqual([
      new URL('/twitter-image.png', siteConfig.url).toString(),
    ]);
  });
});
