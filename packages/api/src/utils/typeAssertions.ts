export function assertDefined<T>(val: T | undefined): asserts val is T {
  if (val === undefined) throw new Error('Value must be defined');
}

export function assertAllDefined(...values: (unknown | undefined)[]): void {
  values.forEach((val, i) => {
    if (val === undefined) {
      throw new Error(`Value at index ${i} must be defined`);
    }
  });
}
