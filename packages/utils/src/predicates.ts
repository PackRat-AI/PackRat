/**
 * Type predicates — the lib-sourced `is*` narrowing primitives. `@packrat/utils`
 * is the technical source (it's the only package allowed to import the libs);
 * `@packrat/guards` re-exports these as the semantic home for narrowing and
 * layers its custom assertions/coercions/enum/zod helpers on top. Prefer
 * importing narrowing from `@packrat/guards`.
 */

// radashi — all 13 predicates guards exposes
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
} from 'radashi';
