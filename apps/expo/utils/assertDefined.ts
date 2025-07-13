export function assertDefined<T>(val: T | undefined): asserts val is T {
  if (val === undefined) throw new Error('Value must be defined');
}
