import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  loadMetadata,
  metadataPath,
  needsUpdate,
  saveMetadata,
  schemaIsCurrent,
} from '@packrat/data-lake/core/cache-metadata';
import { DBConfig } from '@packrat/data-lake/core/constants';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

const TEST_DIR = join(import.meta.dirname, '../../.test-cache');

beforeEach(() => {
  mkdirSync(TEST_DIR, { recursive: true });
});

afterEach(() => {
  rmSync(TEST_DIR, { recursive: true, force: true });
});

describe('cache metadata', () => {
  it('returns null when no metadata file exists', () => {
    expect(loadMetadata(TEST_DIR)).toBeNull();
  });

  it('saves and loads metadata', () => {
    const data = {
      version: '2.0',
      schema_version: '2.0',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      record_count: 100,
      sites: ['rei', 'backcountry'],
    };

    saveMetadata(TEST_DIR, data);
    expect(loadMetadata(TEST_DIR)).toEqual(data);
  });

  it('fills defaults for partial metadata', () => {
    writeFileSync(metadataPath(TEST_DIR), '{"record_count": 5}');
    const result = loadMetadata(TEST_DIR);
    expect(result).not.toBeNull();
    expect(result?.record_count).toBe(5);
    expect(result?.sites).toEqual([]);
  });

  describe('needsUpdate', () => {
    it('returns true when metadata is null', () => {
      expect(needsUpdate(null)).toBe(true);
    });

    it('returns true when no updated_at', () => {
      expect(
        needsUpdate({ version: '2.0', schema_version: '2.0', record_count: 0, sites: [] }),
      ).toBe(true);
    });

    it('returns false when recently updated', () => {
      expect(
        needsUpdate({
          version: '2.0',
          schema_version: '2.0',
          updated_at: new Date().toISOString(),
          record_count: 0,
          sites: [],
        }),
      ).toBe(false);
    });

    it('returns true when stale', () => {
      const staleDate = new Date(Date.now() - (DBConfig.CACHE_REFRESH_HOURS + 1) * 60 * 60 * 1000);
      expect(
        needsUpdate({
          version: '2.0',
          schema_version: '2.0',
          updated_at: staleDate.toISOString(),
          record_count: 0,
          sites: [],
        }),
      ).toBe(true);
    });
  });

  describe('schemaIsCurrent', () => {
    it('returns false for null metadata', () => {
      expect(schemaIsCurrent(null)).toBe(false);
    });

    it('returns true for matching schema version', () => {
      expect(
        schemaIsCurrent({
          version: '2.0',
          schema_version: DBConfig.SCHEMA_VERSION,
          record_count: 0,
          sites: [],
        }),
      ).toBe(true);
    });

    it('returns false for old schema version', () => {
      expect(
        schemaIsCurrent({
          version: '1.0',
          schema_version: '1.0',
          record_count: 0,
          sites: [],
        }),
      ).toBe(false);
    });
  });
});
