/**
 * U13: favicon served at the OAuth host (`mcp.packratai.com/favicon.ico`).
 *
 * Anthropic's domain-ownership verification probe hits this exact path, so a
 * silent regression here ("Content-Type wrong", "zero-byte body", "404")
 * would invalidate the entire listing. The tests below guard the shape that
 * matters:
 *   - The embedded base64 decodes to a non-empty buffer.
 *   - The returned Response is `200` with `image/x-icon`.
 *   - The body length matches the embedded buffer length (no accidental
 *     re-encoding or short-write).
 *   - Repeated calls return fresh buffers (no shared backing store).
 */

import { describe, expect, it } from 'vitest';
import { FAVICON_BYTE_LENGTH, faviconResponse } from '../favicon';

describe('faviconResponse', () => {
  it('embeds a non-empty .ico buffer', () => {
    // The PackRat .ico is ~4.2 KiB; assert a generous floor so this test
    // catches an accidental empty embed without coupling to the exact size.
    expect(FAVICON_BYTE_LENGTH).toBeGreaterThan(2048);
  });

  it('starts with the .ico magic bytes (0x00 0x00 0x01 0x00)', async () => {
    const res = faviconResponse();
    const buf = new Uint8Array(await res.arrayBuffer());
    expect(buf[0]).toBe(0x00);
    expect(buf[1]).toBe(0x00);
    expect(buf[2]).toBe(0x01);
    expect(buf[3]).toBe(0x00);
  });

  it('responds with 200 and image/x-icon Content-Type', async () => {
    const res = faviconResponse();
    expect(res.status).toBe(200);
    expect(res.headers.get('Content-Type')).toBe('image/x-icon');
  });

  it('sets a Cache-Control that lets Anthropic and clients cache safely', () => {
    const res = faviconResponse();
    const cc = res.headers.get('Cache-Control') ?? '';
    expect(cc).toContain('public');
    expect(cc).toMatch(/max-age=\d+/);
  });

  it('Content-Length header matches the body byte length', async () => {
    const res = faviconResponse();
    const headerLen = Number(res.headers.get('Content-Length') ?? '-1');
    const body = new Uint8Array(await res.arrayBuffer());
    expect(headerLen).toBe(body.byteLength);
    expect(body.byteLength).toBe(FAVICON_BYTE_LENGTH);
  });

  it('returns a fresh body buffer per call (no shared backing store)', async () => {
    const a = faviconResponse();
    const b = faviconResponse();
    const [ba, bb] = await Promise.all([a.arrayBuffer(), b.arrayBuffer()]);
    expect(ba).not.toBe(bb); // distinct ArrayBuffer identities
    expect(new Uint8Array(ba)).toEqual(new Uint8Array(bb)); // identical content
  });
});
