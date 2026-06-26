import { provenance } from '@packrat/utils/provenance';
import { describe, expect, it } from 'vitest';
import { analyzeSource, isExcluded, UTIL_NAMES } from '../no-duplicate-utils';

const outsideFile = 'apps/expo/features/foo/utils.ts';
const insideFile = 'packages/utils/src/array.ts';

describe('no-duplicate-utils', () => {
  describe('flags re-implementations outside @packrat/utils', () => {
    it('flags a function declaration of a manifest name', () => {
      const src = [
        'export function unique(items: number[]) {',
        '  return [...new Set(items)];',
        '}',
      ].join('\n');
      const violations = analyzeSource(outsideFile, src);
      expect(violations).toHaveLength(1);
      expect(violations[0]).toMatchObject({ name: 'unique', line: 1, file: outsideFile });
    });

    it('flags an arrow-function const assignment of a manifest name', () => {
      const src =
        'export const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n));';
      const violations = analyzeSource(outsideFile, src);
      expect(violations).toHaveLength(1);
      expect(violations[0]?.name).toBe('clamp');
    });

    it('flags a typed arrow-function const (type annotation before =)', () => {
      const src = 'const isString: (v: unknown) => boolean = (v) => typeof v === "string";';
      const violations = analyzeSource(outsideFile, src);
      expect(violations).toHaveLength(1);
      expect(violations[0]?.name).toBe('isString');
    });

    it('flags a single-bare-param arrow const', () => {
      const src = 'const capitalize = (s) => s.slice(0, 1).toUpperCase() + s.slice(1);';
      const violations = analyzeSource(outsideFile, src);
      expect(violations).toHaveLength(1);
      expect(violations[0]?.name).toBe('capitalize');
    });
  });

  describe('does NOT flag re-exports or imports', () => {
    it('ignores a re-export line', () => {
      const src = "export { unique, clamp } from '@packrat/utils';";
      const violations = analyzeSource(outsideFile, src);
      expect(violations).toHaveLength(0);
    });

    it('ignores a named import line', () => {
      const src = "import { unique, sort, group } from '@packrat/utils';";
      const violations = analyzeSource(outsideFile, src);
      expect(violations).toHaveLength(0);
    });

    it('ignores a comment mentioning a manifest name', () => {
      const src = '// const unique = () => {} would be a re-implementation';
      const violations = analyzeSource(outsideFile, src);
      expect(violations).toHaveLength(0);
    });
  });

  describe('does NOT flag data-valued locals that share a generic name', () => {
    it('ignores `const list = await bucket.list()`', () => {
      const src = 'const list = await bucket.list();';
      const violations = analyzeSource(outsideFile, src);
      expect(violations).toHaveLength(0);
    });

    it('ignores `const title = "some string"`', () => {
      const src = "const title = 'Open up the code for this screen:';";
      const violations = analyzeSource(outsideFile, src);
      expect(violations).toHaveLength(0);
    });

    it('ignores `const group = markersRef.current`', () => {
      const src = 'const group = markersRef.current;';
      const violations = analyzeSource(outsideFile, src);
      expect(violations).toHaveLength(0);
    });

    it('ignores `const all = Object.values(store.get())`', () => {
      const src = 'const all = Object.values(packTemplatesStore.get());';
      const violations = analyzeSource(outsideFile, src);
      expect(violations).toHaveLength(0);
    });
  });

  describe('banned set is derived from the provenance manifest', () => {
    it('UTIL_NAMES equals the manifest keys exactly (auto-syncs as the facade grows)', () => {
      const manifestKeys = Object.keys(provenance);
      expect([...UTIL_NAMES].sort()).toEqual([...manifestKeys].sort());
    });

    it('flags every current manifest name when re-implemented as a function', () => {
      for (const name of Object.keys(provenance)) {
        const src = `export const ${name} = (x) => x;`;
        const violations = analyzeSource(outsideFile, src);
        expect(violations.map((v) => v.name)).toContain(name);
      }
    });

    it('a name absent from the manifest is NOT flagged', () => {
      expect(UTIL_NAMES.has('definitelyNotAManifestName')).toBe(false);
      const src = 'export const definitelyNotAManifestName = (x) => x;';
      const violations = analyzeSource(outsideFile, src);
      expect(violations).toHaveLength(0);
    });
  });

  describe('canonical-source roots are excluded from the walk', () => {
    it('excludes packages/utils (the source of truth)', () => {
      expect(isExcluded('packages/utils')).toBe(true);
      expect(isExcluded(insideFile)).toBe(true);
    });

    it('excludes packages/checks (the analyzer package)', () => {
      expect(isExcluded('packages/checks')).toBe(true);
      expect(isExcluded('packages/checks/src/check-utils-provenance.ts')).toBe(true);
    });

    it('does NOT exclude app code or other packages', () => {
      expect(isExcluded(outsideFile)).toBe(false);
      expect(isExcluded('packages/api/src/routes/guides/index.ts')).toBe(false);
    });

    it('does NOT exclude a sibling path that merely shares a prefix', () => {
      // `packages/utils-extra` must not be treated as inside `packages/utils`.
      expect(isExcluded('packages/utils-extra/src/index.ts')).toBe(false);
    });
  });

  describe('analyzeSource reports the file path it was given', () => {
    it('uses the caller-supplied file path (exclusion is the walker’s job, not the analyzer’s)', () => {
      const src = 'export function unique(xs) { return xs; }';
      const violations = analyzeSource(insideFile, src);
      expect(violations).toHaveLength(1);
      expect(violations[0]?.file).toBe(insideFile);
    });
  });
});
