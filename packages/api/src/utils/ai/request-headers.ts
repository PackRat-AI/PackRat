// Cloudflare permits arbitrary iterable header pairs; Bun and DOM constructor
// types require arrays/tuples. Materialize pairs without relaxing validation.
export function copyRequestHeaders(init?: HeadersInit | Iterable<Iterable<string>>): Headers {
  if (init && Symbol.iterator in init) {
    const pairs: [string, string][] = [];
    for (const pair of init) {
      if (
        (typeof pair !== 'object' && typeof pair !== 'function') ||
        pair === null ||
        !(Symbol.iterator in pair)
      ) {
        throw new TypeError('Header pair must be an iterable object');
      }
      const iterator = pair[Symbol.iterator]();
      const name = iterator.next();
      const value = iterator.next();
      if (name.done || value.done || !iterator.next().done) {
        throw new TypeError('Header pair must contain exactly two values');
      }
      pairs.push([name.value, value.value]);
    }
    return new Headers(pairs);
  }
  return new Headers(init);
}
