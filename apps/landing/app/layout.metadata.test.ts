import { describe, expect, it } from 'vitest';
import { siteConfig } from '../config/site';
import { landingMetadata as metadata } from './metadata';

describe('landing metadata', () => {
  it('includes absolute Open Graph and Twitter image URLs', () => {
    const expectedImageUrl = new URL(siteConfig.ogImage, siteConfig.url).toString();

    expect(metadata.openGraph?.images).toEqual([
      {
        url: expectedImageUrl,
        width: 1200,
        height: 630,
        alt: siteConfig.name,
      },
    ]);

    expect(metadata.twitter?.images).toEqual([expectedImageUrl]);
  });
});
