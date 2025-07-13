export function assertDefined<T>(val: T | undefined): asserts val is T {
  if (val === undefined) throw new Error('Value must be defined');
}

export function assertIsString(value: unknown): asserts value is string {
  if (typeof value !== 'string') {
    throw new Error('Expected a string');
  }
}
