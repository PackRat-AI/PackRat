import { describe, expect, it } from 'vitest';
import { siteConfig } from '../config/site';
import { metadata } from './metadata';

describe('landing metadata', () => {
  it('sets absolute og/twitter image metadata', () => {
    const expected = new URL(siteConfig.ogImage, siteConfig.url).toString();
    expect(metadata.openGraph?.images?.[0]).toMatchObject({
      url: expected,
      width: 1200,
      height: 630,
      alt: siteConfig.name,
    });
    expect(metadata.twitter?.images).toEqual([expected]);
  });
});
