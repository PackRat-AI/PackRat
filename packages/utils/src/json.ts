/**
 * JSON utilities — safe stringify/parse. NEVER use raw `JSON.stringify` or
 * `JSON.parse` outside this package; route everything through here (enforced
 * by the `no-raw-json` ast-grep rule).
 *
 * Sources: `safe-stable-stringify` (stringify) + `destr` (parse).
 */
import { destr } from 'destr';
import { configure } from 'safe-stable-stringify';

/**
 * Safe drop-in for `JSON.stringify`: circular- and BigInt-safe, and
 * **preserves key insertion order** (`deterministic: false`) so output matches
 * raw `JSON.stringify` for normal data — it only differs by not throwing on
 * circular references or BigInt. Use this everywhere you'd reach for
 * `JSON.stringify`.
 */
export const safeStringify = configure({ deterministic: false, bigint: true });

/**
 * Deterministic stringify: keys are sorted, circular- and BigInt-safe. Use for
 * cache keys, hashing, and structural equality — NOT where output key order
 * must mirror input order.
 */
export const stableStringify = configure({ deterministic: true, bigint: true });

/**
 * Escape hatch to build a custom stringifier (`maximumDepth`, `circularValue`,
 * `maximumBreadth`, `strict`, …). See the safe-stable-stringify docs.
 */
export { configure as configureStringify } from 'safe-stable-stringify';

/**
 * Safe drop-in for `JSON.parse`: never throws, guards against prototype
 * pollution (`__proto__`), and returns the input unchanged for non-JSON.
 * Pass a type parameter for the expected shape.
 */
export const safeParse = <T = unknown>(value: string): T => destr<T>(value);
