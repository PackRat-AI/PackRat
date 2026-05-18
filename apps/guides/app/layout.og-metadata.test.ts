import { describe, expect, it } from 'vitest';
import { siteConfig } from '../lib/config';
import { metadata } from './metadata';

describe('guides metadata', () => {
  it('sets absolute og/twitter image metadata', () => {
    const expected = new URL('/opengraph-image', siteConfig.url).toString();
    expect(metadata.openGraph?.images?.[0]).toMatchObject({
      url: expected,
      width: 1200,
      height: 630,
      alt: 'PackRat Guides | Hiking & Outdoor Adventures',
    });
    expect(metadata.twitter?.images).toEqual([expected]);
  });
});
