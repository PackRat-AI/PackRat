import { normalizeImageUrl, rankImage } from '@packrat/data-lake/core/enrichment';
import { describe, expect, it } from 'vitest';

describe('normalizeImageUrl', () => {
  it('strips CDN size query params', () => {
    const url = 'https://cdn.example.com/img.jpg?w=800&h=600&quality=90';
    const normalized = normalizeImageUrl(url);
    expect(normalized).not.toContain('w=800');
    expect(normalized).not.toContain('h=600');
    expect(normalized).not.toContain('quality=90');
  });

  it('strips Cloudinary-style path transforms', () => {
    const url = 'https://res.cloudinary.com/demo/image/upload/w_400/h_300/sample.jpg';
    const normalized = normalizeImageUrl(url);
    expect(normalized).not.toContain('w_400');
    expect(normalized).not.toContain('h_300');
  });

  it('preserves base URL', () => {
    const url = 'https://cdn.example.com/products/tent.jpg';
    expect(normalizeImageUrl(url)).toBe(url);
  });

  it('handles empty string', () => {
    expect(normalizeImageUrl('')).toBe('');
  });

  it('cleans up trailing ?', () => {
    const url = 'https://cdn.example.com/img.jpg?w=800';
    const normalized = normalizeImageUrl(url);
    expect(normalized).not.toMatch(/\?$/);
  });

  it('strips dimension-like path segments', () => {
    const url = 'https://cdn.example.com/200x300/img.jpg';
    const normalized = normalizeImageUrl(url);
    expect(normalized).not.toContain('200x300');
  });
});

describe('rankImage', () => {
  it('ranks product shots highest (0)', () => {
    expect(rankImage('https://cdn.com/product/tent.jpg')).toBe(0);
    expect(rankImage('https://cdn.com/pdp/tent.jpg')).toBe(0);
    expect(rankImage('https://cdn.com/main/tent.jpg')).toBe(0);
    expect(rankImage('https://cdn.com/hero/tent.jpg')).toBe(0);
    expect(rankImage('https://cdn.com/primary/tent.jpg')).toBe(0);
  });

  it('ranks lifestyle shots second (1)', () => {
    expect(rankImage('https://cdn.com/lifestyle/tent-in-use.jpg')).toBe(1);
    expect(rankImage('https://cdn.com/action/climbing.jpg')).toBe(1);
    expect(rankImage('https://cdn.com/model/wearing-jacket.jpg')).toBe(1);
  });

  it('ranks detail shots third (2)', () => {
    expect(rankImage('https://cdn.com/detail/zipper.jpg')).toBe(2);
    expect(rankImage('https://cdn.com/zoom/fabric.jpg')).toBe(2);
    expect(rankImage('https://cdn.com/swatch/red.jpg')).toBe(2);
  });

  it('ranks unknown paths lowest (3)', () => {
    expect(rankImage('https://cdn.com/misc/random.jpg')).toBe(3);
    expect(rankImage('https://cdn.com/images/tent.jpg')).toBe(3);
  });
});
