/**
 * Type declarations for modules that don't ship their own TypeScript definitions.
 */

// react-native internal polyfill helper — no public .d.ts provided by the package
declare module 'react-native/Libraries/Utilities/PolyfillFunctions' {
  export function polyfillGlobal(name: string, getValue: () => unknown): void;
}
