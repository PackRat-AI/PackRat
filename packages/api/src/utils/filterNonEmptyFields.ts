/**
 * Returns true if the value is NOT empty (used for filtering).
 */
function isMeaningfulValue(value: any): boolean {
  if (value === null || value === undefined) return false;
  if (typeof value === 'string' && value.trim() === '') return false;
  if (Array.isArray(value) && value.length === 0) return false;
  if (typeof value === 'object' && Object.keys(value).length === 0) return false;
  return true;
}

/**
 * Filters out fields with null, undefined, empty string, empty array, or empty object.
 */
export function filterNonEmptyFields<T extends Record<string, any>>(obj: T): Partial<T> {
  return Object.fromEntries(
    Object.entries(obj).filter(([_, v]) => isMeaningfulValue(v)),
  ) as Partial<T>;
}
