import { describe, expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { extractRegistryBlock, findViolations, parseRegistry } from './no-undocumented-overrides';

const ROOT = join(import.meta.dir, '..', '..');

describe('findViolations', () => {
  const goodEntry = { reason: 'because', removeWhen: 'someday' };

  test('happy path: every override documented, no stale entries → no violations', () => {
    const overrides = { react: '19.2.6' };
    const registry = { react: goodEntry };
    expect(findViolations(overrides, registry)).toEqual([]);
  });

  test('missing-entry: an override with no registry entry is flagged', () => {
    const overrides = { react: '19.2.6', elysia: '^1.4.0' };
    const registry = { react: goodEntry };
    const v = findViolations(overrides, registry);
    expect(v).toHaveLength(1);
    expect(v[0]).toMatchObject({ kind: 'missing-entry', pkg: 'elysia' });
  });

  test('stale-entry: a registry entry with no matching override is flagged', () => {
    const overrides = { react: '19.2.6' };
    const registry = { react: goodEntry, '@packrat-ai/nativewindui': goodEntry };
    const v = findViolations(overrides, registry);
    expect(v).toHaveLength(1);
    expect(v[0]).toMatchObject({ kind: 'stale-entry', pkg: '@packrat-ai/nativewindui' });
  });

  test('incomplete-entry: empty reason or removeWhen is flagged', () => {
    const overrides = { react: '19.2.6', other: '1.0.0' };
    const registry = {
      react: { reason: '   ', removeWhen: 'someday' },
      other: { reason: 'has reason', removeWhen: '' },
    };
    const v = findViolations(overrides, registry);
    expect(v).toHaveLength(2);
    expect(v.every((x) => x.kind === 'incomplete-entry')).toBe(true);
  });

  test('missing reason field entirely is flagged as incomplete', () => {
    const overrides = { react: '19.2.6' };
    const registry = { react: { removeWhen: 'someday' } };
    const v = findViolations(overrides, registry);
    expect(v).toHaveLength(1);
    expect(v[0]?.kind).toBe('incomplete-entry');
  });
});

describe('registry parsing', () => {
  test('extractRegistryBlock pulls the json fence under the heading', () => {
    const md = '# Doc\n\n## Override registry\n\nintro\n\n```json\n{"react": {}}\n```\n\ntail';
    expect(extractRegistryBlock(md)).toBe('{"react": {}}');
  });

  test('extractRegistryBlock returns null when the heading is absent', () => {
    const md = '# Doc\n\n```json\n{"react": {}}\n```';
    expect(extractRegistryBlock(md)).toBeNull();
  });

  test('parseRegistry returns null on invalid JSON', () => {
    const md = '## Override registry\n\n```json\n{not valid}\n```';
    expect(parseRegistry(md)).toBeNull();
  });

  test('parseRegistry returns null when the block is a JSON array, not an object', () => {
    const md = '## Override registry\n\n```json\n["react"]\n```';
    expect(parseRegistry(md)).toBeNull();
  });

  test('parseRegistry returns the object on a valid block', () => {
    const md =
      '## Override registry\n\n```json\n{"react": {"reason": "a", "removeWhen": "b"}}\n```';
    expect(parseRegistry(md)).toEqual({ react: { reason: 'a', removeWhen: 'b' } });
  });
});

describe('integration: the real repo is in sync', () => {
  test('shipped root overrides all have registry entries, no stale entries', () => {
    const rootPkg = JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf-8')) as {
      overrides?: Record<string, unknown>;
    };
    const markdown = readFileSync(join(ROOT, 'docs', 'dependency-policy.md'), 'utf-8');
    const registry = parseRegistry(markdown);
    expect(registry).not.toBeNull();
    expect(findViolations(rootPkg.overrides ?? {}, registry ?? {})).toEqual([]);
  });
});
