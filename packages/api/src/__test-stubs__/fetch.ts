import { vi } from 'vitest';

// Bun augments fetch with preconnect. Preserve that interface without making
// test doubles open real connections or requiring casts across runtime types.
type FetchCall = (...args: Parameters<typeof fetch>) => ReturnType<typeof fetch>;

export function mockFetch(implementation?: FetchCall) {
  return Object.assign(vi.fn<FetchCall>(implementation), { preconnect: vi.fn() });
}
