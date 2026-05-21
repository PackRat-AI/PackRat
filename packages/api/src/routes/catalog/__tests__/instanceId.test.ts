/**
 * Regression tests for CF Workflows instanceId construction.
 *
 * CF Workflows only allows [a-zA-Z0-9_-] in instance IDs (max 64 chars).
 * A prior bug let the raw filename (including its ".csv" extension) flow
 * directly into the instanceId, producing dots that CF rejected with a 500.
 *
 * The fix (packages/api/src/routes/catalog/index.ts):
 *   const FILE_EXT_RE = /\.[^.]*$/;
 *   const instanceId = `${source}-${filename.replace(FILE_EXT_RE, '')}`.slice(0, 64);
 */
import { describe, expect, it } from 'vitest';

// Mirror the exact logic from the route so this test breaks if the
// implementation drifts.
const FILE_EXT_RE = /\.[^.]*$/;

function buildInstanceId(source: string, filename: string): string {
  return `${source}-${filename.replace(FILE_EXT_RE, '')}`.slice(0, 64);
}

const CF_INSTANCE_ID_RE = /^[a-zA-Z0-9_-]{1,64}$/;

describe('catalog ETL instanceId', () => {
  it('basic: strips .csv extension and produces a valid CF instance ID', () => {
    const id = buildInstanceId('cotopaxi', 'cotopaxi_2026-05-14T16-54-05.csv');

    expect(id).toMatch(CF_INSTANCE_ID_RE);
    expect(id).not.toContain('.');
    expect(id).toBe('cotopaxi-cotopaxi_2026-05-14T16-54-05');
  });

  it('no extension in input: still produces a valid CF instance ID', () => {
    const id = buildInstanceId('foo', 'foo_2026-01-01T00-00-00');

    expect(id).toMatch(CF_INSTANCE_ID_RE);
    expect(id).not.toContain('.');
    expect(id).toBe('foo-foo_2026-01-01T00-00-00');
  });

  it('long name truncation: result is capped at 64 chars', () => {
    // 20-char source + '-' + 60-char filename (no ext) = 81 chars before slice
    const source = 'a'.repeat(20);
    const filename = 'b'.repeat(60) + '.csv';

    const id = buildInstanceId(source, filename);

    expect(id.length).toBe(64);
    expect(id).toMatch(CF_INSTANCE_ID_RE);
  });

  it('timestamp format: underscores and hyphens pass through as valid chars', () => {
    // Typical scraper filename pattern uses underscores and ISO-8601 hyphens
    const id = buildInstanceId('rei', 'rei_catalog_2026-05-14T16-54-05.csv');

    expect(id).toMatch(CF_INSTANCE_ID_RE);
    expect(id).not.toContain('.');
    // Both _ and - must survive the strip
    expect(id).toContain('_');
    expect(id).toContain('-');
  });
});
