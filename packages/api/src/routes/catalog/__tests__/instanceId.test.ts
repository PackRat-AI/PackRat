/**
 * Regression tests for CF Workflows instanceId construction.
 *
 * CF Workflows constrains instance IDs to `^[a-zA-Z0-9_][a-zA-Z0-9-_]*$`
 * (max 64 chars enforced by CF; we cap at 100). A prior bug let the raw
 * filename (including its ".csv" extension, spaces, and punctuation) flow
 * directly into the instanceId, producing chars that CF rejected with a 500.
 *
 * The fix (packages/api/src/utils/buildInstanceId.ts): the exported
 * `buildInstanceId` helper strips the extension, replaces disallowed chars
 * with `-`, collapses/trims `-`, and guarantees a valid leading char.
 */
import { buildInstanceId } from '@packrat/api/utils/buildInstanceId';
import { describe, expect, it } from 'vitest';

// CF Workflows instance-id constraint.
const CF_INSTANCE_ID_RE = /^[a-zA-Z0-9_][a-zA-Z0-9-_]*$/;

describe('catalog ETL instanceId', () => {
  it('basic: strips .csv extension and produces a valid CF instance ID', () => {
    const id = buildInstanceId('cotopaxi-cotopaxi_2026-05-14T16-54-05.csv');

    expect(id).toMatch(CF_INSTANCE_ID_RE);
    expect(id).not.toContain('.');
    expect(id).toBe('cotopaxi-cotopaxi_2026-05-14T16-54-05');
  });

  it('no extension in input: still produces a valid CF instance ID', () => {
    const id = buildInstanceId('foo-foo_2026-01-01T00-00-00');

    expect(id).toMatch(CF_INSTANCE_ID_RE);
    expect(id).not.toContain('.');
    expect(id).toBe('foo-foo_2026-01-01T00-00-00');
  });

  it('long name truncation: result is capped at 100 chars', () => {
    const id = buildInstanceId(`${'b'.repeat(150)}.csv`);

    expect(id.length).toBe(100);
    expect(id).toMatch(CF_INSTANCE_ID_RE);
  });

  it('timestamp format: underscores and hyphens pass through as valid chars', () => {
    const id = buildInstanceId('rei-rei_catalog_2026-05-14T16-54-05.csv');

    expect(id).toMatch(CF_INSTANCE_ID_RE);
    expect(id).not.toContain('.');
    expect(id).toContain('_');
    expect(id).toContain('-');
  });

  it('spaces and punctuation: replaced with hyphens and collapsed', () => {
    const id = buildInstanceId('rei - cool catalog (final).csv');

    expect(id).toMatch(CF_INSTANCE_ID_RE);
    expect(id).not.toContain(' ');
    expect(id).not.toContain('(');
    expect(id).not.toContain(')');
    // No doubled hyphens from collapsing runs of disallowed chars.
    expect(id).not.toContain('--');
    expect(id).toBe('rei-cool-catalog-final');
  });

  it('leading dot / hidden file: result starts with a valid char', () => {
    const id = buildInstanceId('.hidden.csv');

    expect(id).toMatch(CF_INSTANCE_ID_RE);
    expect(id[0]).toMatch(/[A-Za-z0-9_]/);
  });

  it('leading non-alphanumeric: prefixed so first char is valid', () => {
    const id = buildInstanceId('-_-weird-name.csv');

    expect(id).toMatch(CF_INSTANCE_ID_RE);
    expect(id[0]).toMatch(/[A-Za-z0-9_]/);
  });

  it('all-punctuation input: still yields a non-empty valid ID', () => {
    const id = buildInstanceId('!!!.csv');

    expect(id.length).toBeGreaterThan(0);
    expect(id).toMatch(CF_INSTANCE_ID_RE);
  });

  it('over-long with punctuation: sanitized then capped at 100 chars', () => {
    const id = buildInstanceId(`${'a b!'.repeat(60)}.csv`);

    expect(id.length).toBeLessThanOrEqual(100);
    expect(id).toMatch(CF_INSTANCE_ID_RE);
  });
});
