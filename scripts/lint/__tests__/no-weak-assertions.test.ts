import { describe, expect, it } from 'vitest';
import { analyzeSource, isFileDisabled } from '../no-weak-assertions';

const fakeFile = 'apps/test/example.test.ts';

describe('no-weak-assertions', () => {
  describe('assertion-free-test', () => {
    it('flags an it() block with zero expect() or expect-helper calls', () => {
      const src = `
        describe('thing', () => {
          it('does something', () => {
            const x = 1 + 1;
            console.log(x);
          });
        });
      `;
      const violations = analyzeSource(fakeFile, src);
      expect(violations).toHaveLength(1);
      expect(violations[0]?.rule).toBe('assertion-free-test');
      expect(violations[0]?.line).toBe(3);
    });

    it('does NOT flag when a custom expect-helper is used', () => {
      const src = `
        it('rejects unauth', async () => {
          const res = await api('/x');
          expectUnauthorized(res);
        });
      `;
      const violations = analyzeSource(fakeFile, src);
      expect(violations.filter((v) => v.rule === 'assertion-free-test')).toHaveLength(0);
    });

    it('does NOT flag it.todo or it.skip blocks', () => {
      const src = `
        it.todo('eventually');
        it.skip('not yet', () => {
          const x = 1;
        });
      `;
      const violations = analyzeSource(fakeFile, src);
      expect(violations).toHaveLength(0);
    });
  });

  describe('only-tobedefined', () => {
    it('flags a block where every expect() uses .toBeDefined()', () => {
      const src = `
        it('returns something', () => {
          const x = parse('foo');
          expect(x).toBeDefined();
        });
      `;
      const violations = analyzeSource(fakeFile, src);
      expect(violations).toHaveLength(1);
      expect(violations[0]?.rule).toBe('only-tobedefined');
    });

    it('flags .toBeTruthy() and .toBeFalsy() blocks', () => {
      const src = `
        it('truthy', () => {
          expect(x).toBeTruthy();
        });
        it('falsy', () => {
          expect(y).toBeFalsy();
        });
      `;
      const violations = analyzeSource(fakeFile, src);
      expect(violations.filter((v) => v.rule === 'only-tobedefined')).toHaveLength(2);
    });

    it('does NOT flag .toBeUndefined() — that asserts a specific return value', () => {
      const src = `
        it('returns undefined when input is missing', () => {
          expect(getNotes(item)).toBeUndefined();
        });
        it('returns null when not found', () => {
          expect(lookup(id)).toBeNull();
        });
      `;
      const violations = analyzeSource(fakeFile, src);
      expect(violations).toHaveLength(0);
    });

    it('does NOT flag when at least one expect() uses a specific matcher', () => {
      const src = `
        it('returns a valid result', () => {
          const x = parse('foo');
          expect(x).toBeDefined();
          expect(x.value).toBe(42);
        });
      `;
      const violations = analyzeSource(fakeFile, src);
      expect(violations).toHaveLength(0);
    });

    it('does NOT flag when an expect-helper is present', () => {
      const src = `
        it('returns a valid result', () => {
          const x = parse('foo');
          expect(x).toBeDefined();
          expectShape(x);
        });
      `;
      const violations = analyzeSource(fakeFile, src);
      expect(violations).toHaveLength(0);
    });
  });

  describe('bare-tohavebeencalled', () => {
    it('flags .toHaveBeenCalled() without .toHaveBeenCalledWith or Times', () => {
      const src = `
        it('calls the thing', () => {
          doIt();
          expect(spy).toHaveBeenCalled();
        });
      `;
      const violations = analyzeSource(fakeFile, src);
      expect(violations.filter((v) => v.rule === 'bare-tohavebeencalled')).toHaveLength(1);
    });

    it('does NOT flag when .toHaveBeenCalledWith is present in the same block', () => {
      const src = `
        it('calls the thing with the right arg', () => {
          doIt('foo');
          expect(spy).toHaveBeenCalled();
          expect(spy).toHaveBeenCalledWith('foo');
        });
      `;
      const violations = analyzeSource(fakeFile, src);
      expect(violations.filter((v) => v.rule === 'bare-tohavebeencalled')).toHaveLength(0);
    });

    it('does NOT flag when .toHaveBeenCalledTimes is present', () => {
      const src = `
        it('calls the thing twice', () => {
          doIt(); doIt();
          expect(spy).toHaveBeenCalled();
          expect(spy).toHaveBeenCalledTimes(2);
        });
      `;
      const violations = analyzeSource(fakeFile, src);
      expect(violations.filter((v) => v.rule === 'bare-tohavebeencalled')).toHaveLength(0);
    });
  });

  describe('large-snapshot', () => {
    it('flags toMatchInlineSnapshot bodies > 50 lines', () => {
      const snapshotBody = `\n${'  line\n'.repeat(60)}`;
      const src = `
        it('matches snapshot', () => {
          expect(big).toMatchInlineSnapshot(\`${snapshotBody}\`);
        });
      `;
      const violations = analyzeSource(fakeFile, src);
      expect(violations.some((v) => v.rule === 'large-snapshot')).toBe(true);
    });

    it('does NOT flag small inline snapshots', () => {
      const src = `
        it('matches snapshot', () => {
          expect(small).toMatchInlineSnapshot(\`"hello"\`);
        });
      `;
      const violations = analyzeSource(fakeFile, src);
      expect(violations.filter((v) => v.rule === 'large-snapshot')).toHaveLength(0);
    });
  });

  describe('file-level disable comment', () => {
    it('skips the entire file when "no-weak-assertions: disable" is in the first 5 lines', () => {
      const src = `// no-weak-assertions: disable
        it('grandfathered', () => {
          expect(x).toBeDefined();
        });
        it('also grandfathered', () => {
          // assertion-free
        });
      `;
      expect(isFileDisabled(src)).toBe(true);
      const violations = analyzeSource(fakeFile, src);
      expect(violations).toHaveLength(0);
    });

    it('does NOT skip when the disable comment is after line 5', () => {
      const src = `
        // line 1
        // line 2
        // line 3
        // line 4
        // line 5
        // no-weak-assertions: disable
        it('not grandfathered', () => {
          const x = 1;
        });
      `;
      expect(isFileDisabled(src)).toBe(false);
      const violations = analyzeSource(fakeFile, src);
      expect(violations.length).toBeGreaterThan(0);
    });
  });

  describe('multiple violations in one file', () => {
    it('reports each violation separately', () => {
      const src = `
        it('first violation', () => {
          const x = 1;
        });
        it('second violation', () => {
          expect(y).toBeDefined();
        });
        it('third violation', () => {
          expect(spy).toHaveBeenCalled();
        });
      `;
      const violations = analyzeSource(fakeFile, src);
      expect(violations).toHaveLength(3);
      expect(violations.map((v) => v.rule).sort()).toEqual([
        'assertion-free-test',
        'bare-tohavebeencalled',
        'only-tobedefined',
      ]);
    });
  });
});
