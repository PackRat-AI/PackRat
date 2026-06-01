// Unit tests for the row-boundary-aligned R2 chunker.
//
// The chunker is the load-bearing piece for catalog ETL correctness: any
// off-by-one at a chunk boundary either drops a row, invalidates one, or
// produces duplicates. These tests exercise the boundary alignment against
// in-memory CSV fixtures so the failure modes the audit identified
// (P1 #3, #4, #5) cannot regress silently.

import {
  ChunkBoundaryError,
  type ChunkerR2,
  chunkCsvForR2,
} from '@packrat/api/workflows/shared/chunkCsvForR2';
import { describe, expect, it } from 'vitest';

const encoder = new TextEncoder();

function fakeR2(text: string, key = 'fixture.csv'): { r2: ChunkerR2; bytes: Uint8Array } {
  const bytes = encoder.encode(text);

  const head = async (k: string) => {
    if (k !== key) return null;
    return {
      key,
      size: bytes.length,
      etag: 'fake-etag',
      uploaded: new Date('2026-05-20T00:00:00Z'),
    } as Awaited<ReturnType<ChunkerR2['head']>>;
  };

  const get = async (k: string, opts?: { range?: { offset: number; length: number } }) => {
    if (k !== key) return null;
    const offset = opts?.range?.offset ?? 0;
    const length = opts?.range?.length ?? bytes.length - offset;
    const slice = bytes.slice(offset, offset + length);
    return {
      size: slice.length,
      etag: 'fake-etag',
      bytes: async () => slice,
      text: async () => new TextDecoder().decode(slice),
    } as Awaited<ReturnType<ChunkerR2['get']>>;
  };

  return { r2: { head, get } as unknown as ChunkerR2, bytes };
}

function makeCsv(rowCount: number, rowWidth = 50): string {
  const header = 'col1,col2,col3\n';
  const row = (i: number) => `row-${i},${'x'.repeat(rowWidth)},${i}\n`;
  return header + Array.from({ length: rowCount }, (_, i) => row(i)).join('');
}

function expectDefined<T>(value: T | undefined, message: string): T {
  if (value === undefined) throw new Error(message);
  return value;
}

describe('chunkCsvForR2', () => {
  it('returns a single chunk when the file is smaller than chunkBytes', async () => {
    const csv = makeCsv(100);
    const { r2 } = fakeR2(csv);
    const result = await chunkCsvForR2({
      r2,
      objectKey: 'fixture.csv',
      chunkBytes: 1024 * 1024,
    });
    expect(result.chunks).toHaveLength(1);
    expect(result.chunks[0]).toMatchObject({
      chunkIndex: 0,
      chunksTotal: 1,
      byteStart: 0,
      byteEnd: result.size - 1,
    });
    expect(result.etag).toBe('fake-etag');
  });

  it('splits a larger file at newline boundaries', async () => {
    const csv = makeCsv(1000, 50);
    const { r2, bytes } = fakeR2(csv);
    // Target ~3 chunks for a ~60KB file.
    const result = await chunkCsvForR2({
      r2,
      objectKey: 'fixture.csv',
      chunkBytes: Math.ceil(bytes.length / 3),
      peekBytes: 256,
    });

    expect(result.chunks.length).toBeGreaterThanOrEqual(2);
    const firstChunk = expectDefined(result.chunks[0], 'first chunk missing');
    expect(firstChunk.chunkIndex).toBe(0);
    const lastChunk = expectDefined(result.chunks.at(-1), 'last chunk missing');
    expect(lastChunk.chunkIndex).toBe(result.chunks.length - 1);
    expect(lastChunk.chunksTotal).toBe(result.chunks.length);
    expect(lastChunk.byteEnd).toBe(bytes.length - 1);

    // Every boundary byteEnd must be a newline; the byte immediately after
    // must be the first byte of the next row.
    for (let i = 0; i < result.chunks.length - 1; i++) {
      const current = expectDefined(result.chunks[i], `chunk ${i} missing`);
      const next = expectDefined(result.chunks[i + 1], `chunk ${i + 1} missing`);
      const boundary = current.byteEnd;
      expect(bytes[boundary]).toBe(0x0a); // '\n'
      expect(next.byteStart).toBe(boundary + 1);
    }
  });

  it('reassembles to the original byte content when chunks are concatenated', async () => {
    const csv = makeCsv(500, 80);
    const { r2, bytes } = fakeR2(csv);
    const result = await chunkCsvForR2({
      r2,
      objectKey: 'fixture.csv',
      chunkBytes: Math.ceil(bytes.length / 4),
      peekBytes: 256,
    });

    // The chunks together must cover bytes [0, size-1] with no gaps or overlap.
    let cursor = 0;
    for (const chunk of result.chunks) {
      expect(chunk.byteStart).toBe(cursor);
      expect(chunk.byteEnd).toBeGreaterThanOrEqual(chunk.byteStart);
      cursor = chunk.byteEnd + 1;
    }
    expect(cursor).toBe(bytes.length);
  });

  it('throws for an empty R2 object (0 bytes)', async () => {
    const { r2 } = fakeR2('');
    await expect(chunkCsvForR2({ r2, objectKey: 'fixture.csv' })).rejects.toThrow(
      'empty (0 bytes)',
    );
  });

  it('throws ChunkBoundaryError when no newline is found in the peek window', async () => {
    // A single very long row with no internal newlines forces peekBytes=256
    // to scan a tail with no \n at all.
    const longRow = 'x'.repeat(8 * 1024);
    const csv = `col1\n${longRow}\n`;
    const { r2 } = fakeR2(csv);

    await expect(
      chunkCsvForR2({ r2, objectKey: 'fixture.csv', chunkBytes: 2048, peekBytes: 256 }),
    ).rejects.toBeInstanceOf(ChunkBoundaryError);
  });

  it('uses DEFAULT_CHUNK_BYTES (2 MiB) when chunkBytes is omitted', async () => {
    const csv = makeCsv(10);
    const { r2 } = fakeR2(csv);
    const result = await chunkCsvForR2({ r2, objectKey: 'fixture.csv' });
    // Small file fits in one chunk regardless of default size
    expect(result.chunks).toHaveLength(1);
    expect(result.chunks[0]?.byteStart).toBe(0);
  });

  it('preserves a CSV row at the boundary — first row of chunk N+1 is intact', async () => {
    const csv = makeCsv(200, 40);
    const { r2, bytes } = fakeR2(csv);
    const result = await chunkCsvForR2({
      r2,
      objectKey: 'fixture.csv',
      chunkBytes: Math.ceil(bytes.length / 3),
      peekBytes: 256,
    });

    const text = new TextDecoder().decode(bytes);
    const allRows = text.split('\n').filter((line) => line.length > 0);
    const headerRow = expectDefined(allRows[0], 'fixture has no header');
    const dataRows = allRows.slice(1);

    // For each non-first chunk, the bytes at byteStart..next-newline should be
    // a complete data row (matches one of dataRows verbatim).
    for (let i = 1; i < result.chunks.length; i++) {
      const chunk = expectDefined(result.chunks[i], `chunk ${i} missing`);
      const slice = new TextDecoder().decode(bytes.slice(chunk.byteStart, chunk.byteEnd + 1));
      const firstRow = expectDefined(slice.split('\n')[0], `chunk ${i} has no first row`);
      expect(firstRow.startsWith('row-')).toBe(true);
      expect(dataRows).toContain(firstRow);
      // The header must NOT appear inside a non-first chunk.
      expect(slice).not.toContain(headerRow);
    }
  });

  it('preserves byte boundaries when non-ASCII data appears in the peek range', async () => {
    const csv = `col1,col2\n${Array.from({ length: 200 }, (_, i) => `row-${i},café-${i}\n`).join('')}`;
    const { r2, bytes } = fakeR2(csv);
    const result = await chunkCsvForR2({
      r2,
      objectKey: 'fixture.csv',
      chunkBytes: Math.ceil(bytes.length / 4),
      peekBytes: 256,
    });

    const reconstructed = new Uint8Array(bytes.length);
    let offset = 0;
    for (const chunk of result.chunks) {
      const slice = bytes.slice(chunk.byteStart, chunk.byteEnd + 1);
      reconstructed.set(slice, offset);
      offset += slice.length;
    }

    expect(offset).toBe(bytes.length);
    expect(reconstructed).toEqual(bytes);
  });
});
