import { describe, expect, it } from 'vitest';
import { asNonNullableRef } from '../asNonNullableRef';

describe('asNonNullableRef', () => {
  // -------------------------------------------------------------------------
  // Basic functionality
  // -------------------------------------------------------------------------
  describe('basic functionality', () => {
    it('casts nullable ref to non-nullable', () => {
      const nullableRef = { current: 'test' } as React.RefObject<string | null>;
      const nonNullableRef = asNonNullableRef(nullableRef);

      // Type assertion should succeed
      expect(nonNullableRef).toBeDefined();
      expect(nonNullableRef.current).toBe('test');
    });

    it('handles ref with null current value', () => {
      const nullableRef = { current: null } as React.RefObject<HTMLElement | null>;
      const nonNullableRef = asNonNullableRef(nullableRef);

      // The cast succeeds even with null value (runtime behavior)
      expect(nonNullableRef).toBeDefined();
      expect(nonNullableRef.current).toBeNull();
    });

    it('preserves ref object structure', () => {
      const originalRef = { current: 'value' } as React.RefObject<string | null>;
      const castedRef = asNonNullableRef(originalRef);

      // Should be the same object reference
      expect(castedRef).toBe(originalRef);
    });
  });

  // -------------------------------------------------------------------------
  // Type assertions
  // -------------------------------------------------------------------------
  describe('type assertions', () => {
    it('allows assignment to non-nullable ref type', () => {
      const nullableRef = { current: 42 } as React.RefObject<number | null>;
      const nonNullableRef: React.RefObject<number> = asNonNullableRef(nullableRef);

      expect(nonNullableRef.current).toBe(42);
    });

    it('works with complex types', () => {
      type ComplexType = { id: number; name: string };
      const nullableRef = {
        current: { id: 1, name: 'test' },
      } as React.RefObject<ComplexType | null>;

      const nonNullableRef = asNonNullableRef(nullableRef);
      expect(nonNullableRef.current?.id).toBe(1);
      expect(nonNullableRef.current?.name).toBe('test');
    });
  });

  // -------------------------------------------------------------------------
  // Edge cases
  // -------------------------------------------------------------------------
  describe('edge cases', () => {
    it('handles undefined current value', () => {
      const ref = { current: null } as React.RefObject<string | null>;
      const castedRef = asNonNullableRef(ref);

      expect(castedRef.current).toBeNull();
    });

    it('handles empty object', () => {
      const ref = { current: {} } as React.RefObject<Record<string, unknown> | null>;
      const castedRef = asNonNullableRef(ref);

      expect(castedRef.current).toEqual({});
    });

    it('handles array ref', () => {
      const ref = { current: [1, 2, 3] } as React.RefObject<number[] | null>;
      const castedRef = asNonNullableRef(ref);

      expect(castedRef.current).toEqual([1, 2, 3]);
    });
  });

  // -------------------------------------------------------------------------
  // Real-world usage scenarios
  // -------------------------------------------------------------------------
  describe('real-world usage', () => {
    it('works with DOM element refs', () => {
      // Simulating a React ref to a DOM element
      const domRef = { current: null } as React.RefObject<HTMLDivElement | null>;
      const nonNullableRef = asNonNullableRef(domRef);

      // In real usage, this allows passing to APIs that expect non-nullable refs
      // but handle null internally
      expect(nonNullableRef).toBeDefined();
    });

    it('works with component instance refs', () => {
      class MockComponent {
        method() {
          return 'called';
        }
      }

      const instance = new MockComponent();
      const compRef = { current: instance } as React.RefObject<MockComponent | null>;
      const nonNullableRef = asNonNullableRef(compRef);

      expect(nonNullableRef.current?.method()).toBe('called');
    });
  });
});
