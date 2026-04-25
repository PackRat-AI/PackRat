/**
 * @packrat/guards — runtime type guards and narrowing helpers.
 *
 * Single import path for all type narrowing in the monorepo.
 * Composes radash primitives, ts-extras utilities, and custom
 * project-specific helpers. Never use `as SomeType` casts — use
 * a guard or parser from this package instead.
 */

// --- radash primitives ---
export {
  isArray,
  isDate,
  isEmpty,
  isEqual,
  isFloat,
  isFunction,
  isInt,
  isNumber,
  isObject,
  isPrimitive,
  isPromise,
  isString,
  isSymbol,
} from 'radash';
// --- ts-extras: nullish guards ---
// --- ts-extras: assertion helpers ---
// --- ts-extras: type-safe object/array utilities ---
export {
  arrayFirst,
  arrayIncludes,
  arrayLast,
  assertError,
  assertNever,
  isDefined,
  isPresent,
  keyIn,
  not,
  objectEntries,
  objectFromEntries,
  objectKeys,
  objectMapValues,
  objectValues,
  setHas,
} from 'ts-extras';

export * from './assertions';
export * from './enum';
export * from './narrow';
export * from './parse';
