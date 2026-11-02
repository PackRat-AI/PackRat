import { describe, expect, it } from 'vitest';
import { postShareUrl, sharedPostIdFromUrl } from '../share';

const id = '0b0c6f0e-6f39-4c56-9a7e-2f1d3f9d8a11';

describe('postShareUrl', () => {
  it('builds the packratai.com link from the public id', () => {
    expect(postShareUrl({ publicId: id })).toBe(`https://packratai.com/p/${id}`);
  });

  it('is null for a post without a public id', () => {
    expect(postShareUrl({})).toBeNull();
  });
});

describe('sharedPostIdFromUrl', () => {
  it('reads web and app links', () => {
    expect(sharedPostIdFromUrl(`https://packratai.com/p/${id}`)).toBe(id);
    expect(sharedPostIdFromUrl(`https://WWW.packratai.com/p/${id}/?utm=x`)).toBe(id);
    expect(sharedPostIdFromUrl(`packrat://p/${id}`)).toBe(id);
  });

  it('rejects other hosts, paths and schemes', () => {
    expect(sharedPostIdFromUrl(`https://example.com/p/${id}`)).toBeNull();
    expect(sharedPostIdFromUrl('https://packratai.com/p/')).toBeNull();
    expect(sharedPostIdFromUrl(`https://packratai.com/x/${id}`)).toBeNull();
    expect(sharedPostIdFromUrl(`packrat://post/${id}`)).toBeNull();
    expect(sharedPostIdFromUrl(`ftp://packratai.com/p/${id}`)).toBeNull();
    expect(sharedPostIdFromUrl('not a url')).toBeNull();
  });
});
