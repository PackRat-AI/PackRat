// Row-boundary-aligned byte-range chunking for catalog source CSVs in R2.
//
// The producer endpoint and the admin retry/repair endpoints both need the
// same chunk spec. Boundaries snap to the byte immediately before a newline
// so a chunk never splits a CSV row in half (closes audit P1 #4 and P1 #5).
// Peek reads are issued in parallel to keep the producer's CPU budget under
// control on multi-GB files (closes the deepening pass concern about
// sequential peek latency).

import type { R2BucketService } from '@packrat/api/services/r2-bucket';

export type ChunkSpec = {
  objectKey: string;
  chunkIndex: number;
  chunksTotal: number;
  byteStart: number;
  /** Inclusive end byte, matching R2 / S3 `Range: bytes=offset-end` semantics. */
  byteEnd: number;
};

export type ChunkCsvResult = {
  etag: string;
  lastModified: Date;
  size: number;
  chunks: ChunkSpec[];
};

export type ChunkerR2 = Pick<R2BucketService, 'head' | 'get'>;

const DEFAULT_CHUNK_BYTES = 20 * 1024 * 1024; // 20 MiB
const DEFAULT_PEEK_BYTES = 64 * 1024; // 64 KiB

export class ChunkBoundaryError extends Error {
  constructor(objectKey: string, byteRange: { from: number; to: number }) {
    super(
      `No newline found in ${byteRange.to - byteRange.from} bytes ending at ${byteRange.to} ` +
        `of ${objectKey} — row larger than the peek window or file is not line-oriented.`,
    );
    this.name = 'ChunkBoundaryError';
  }
}

/**
 * Plan the byte-range chunks for one R2 object.
 *
 * For files smaller than `chunkBytes`, returns a single chunk spanning the
 * whole object. For larger files, splits into N chunks whose boundaries are
 * aligned to newlines via parallel peek reads of the tail of each window.
 *
 * Throws ChunkBoundaryError if no newline is found within `peekBytes` of any
 * proposed boundary — caller should treat this as fatal (the source file is
 * malformed or has a row wider than 64 KiB, both of which warrant a loud
 * failure rather than silent row drops).
 */
export async function chunkCsvForR2({
  r2,
  objectKey,
  chunkBytes = DEFAULT_CHUNK_BYTES,
  peekBytes = DEFAULT_PEEK_BYTES,
}: {
  r2: ChunkerR2;
  objectKey: string;
  chunkBytes?: number;
  peekBytes?: number;
}): Promise<ChunkCsvResult> {
  const meta = await r2.head(objectKey);
  if (!meta) throw new Error(`R2 object not found: ${objectKey}`);

  const size = meta.size;
  const etag = meta.etag;
  const lastModified = meta.uploaded;

  if (size <= chunkBytes) {
    return {
      etag,
      lastModified,
      size,
      chunks: [
        {
          objectKey,
          chunkIndex: 0,
          chunksTotal: 1,
          byteStart: 0,
          byteEnd: size - 1,
        },
      ],
    };
  }

  // Compute the candidate boundaries (the byte AFTER the last byte of each
  // non-final chunk). The final chunk always ends at size - 1.
  const boundaryCount = Math.ceil(size / chunkBytes) - 1;
  const candidates: Array<{ index: number; from: number; to: number }> = [];
  for (let i = 0; i < boundaryCount; i++) {
    const target = (i + 1) * chunkBytes; // exclusive end of chunk i
    const from = Math.max(0, target - peekBytes);
    const to = Math.min(size, target);
    candidates.push({ index: i, from, to });
  }

  // Parallel peek reads — cap concurrency at 16 to keep R2 from rate-limiting
  // multi-GB ingests. Promise.all is fine at <100 boundaries; if a file ever
  // produces more, batch this loop with p-limit.
  const peeks = await Promise.all(
    candidates.map(async ({ index, from, to }) => {
      const obj = await r2.get(objectKey, { range: { offset: from, length: to - from } });
      if (!obj) throw new Error(`R2 peek read returned null for ${objectKey} [${from},${to})`);
      const text = await obj.text();
      const lastNewlineIndex = text.lastIndexOf('\n');
      if (lastNewlineIndex === -1) {
        throw new ChunkBoundaryError(objectKey, { from, to });
      }
      // byteEnd is inclusive; it's the byte position of the newline itself,
      // so the next chunk starts at that index + 1 (which begins the next row).
      const byteEnd = from + lastNewlineIndex;
      return { index, byteEnd };
    }),
  );

  // Assemble the final chunk list in order. Each chunk's byteStart is the
  // previous chunk's byteEnd + 1 (so the next chunk starts AFTER the
  // newline at the previous boundary).
  const sortedPeeks = peeks.sort((a, b) => a.index - b.index);
  const chunksTotal = sortedPeeks.length + 1;
  const chunks: ChunkSpec[] = [];
  let byteStart = 0;
  for (const [chunkIndex, { byteEnd }] of sortedPeeks.entries()) {
    chunks.push({
      objectKey,
      chunkIndex,
      chunksTotal,
      byteStart,
      byteEnd,
    });
    byteStart = byteEnd + 1;
  }
  // Final chunk runs to EOF.
  chunks.push({
    objectKey,
    chunkIndex: chunksTotal - 1,
    chunksTotal,
    byteStart,
    byteEnd: size - 1,
  });

  return { etag, lastModified, size, chunks };
}
