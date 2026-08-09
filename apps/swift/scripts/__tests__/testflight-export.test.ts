import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { basename, join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { findExportedIPA, TestFlightExportError } from '../lib/testflight-export';

let tempDirs: string[] = [];

function makeTempDir() {
  const dir = mkdtempSync(join(tmpdir(), 'packrat-testflight-export-'));
  tempDirs.push(dir);
  return dir;
}

afterEach(() => {
  for (const dir of tempDirs) {
    rmSync(dir, { recursive: true, force: true });
  }
  tempDirs = [];
});

describe('findExportedIPA', () => {
  it('returns the exported ipa regardless of scheme name', () => {
    const dir = makeTempDir();
    writeFileSync(join(dir, 'PackRat.ipa'), '');

    expect(basename(findExportedIPA(dir))).toBe('PackRat.ipa');
  });

  it('fails when export did not produce an ipa', () => {
    const dir = makeTempDir();
    writeFileSync(join(dir, 'ExportOptions.plist'), '');

    expect(() => findExportedIPA(dir)).toThrow(TestFlightExportError);
    expect(() => findExportedIPA(dir)).toThrow('No .ipa file found');
  });

  it('fails when export produced multiple ipa files', () => {
    const dir = makeTempDir();
    writeFileSync(join(dir, 'PackRat.ipa'), '');
    writeFileSync(join(dir, 'PackRat Swift.ipa'), '');

    expect(() => findExportedIPA(dir)).toThrow('Expected one .ipa file');
  });
});
