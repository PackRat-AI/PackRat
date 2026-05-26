/**
 * Live-Worker integration tests for the U16 `/health` and `/status`
 * endpoints.
 *
 * **Deferred (U17 follow-up):** see `./well-known.test.ts` for the
 * full deferral rationale — same `ajv`-in-workerd blocker.
 *
 * Unit-level coverage of `handleHealth` / `handleStatus` lives in
 * `../auth.test.ts` and exercises every probe-result branch directly.
 * The cases below are the end-to-end smoke that proves the route
 * dispatch through the outer fetch wrapper (post-U3+U4: direct route
 * table in `index.ts`, no OAuth provider in the request path) is intact.
 */

import { describe, it } from 'vitest';

describe('/health and /status (integration — deferred per U17 follow-up)', () => {
  it.todo('GET /health returns a JSON envelope with service + version + probes block');

  it.todo('GET / aliases /health (same body shape)');

  it.todo(
    'GET /status returns the public-safe metadata block with no secrets ' +
      '(scope catalog, brand URLs, commitSha sentinel "unknown")',
  );

  it.todo('every response carries an X-Correlation-Id header (U15 outer-wrapper contract)');
});
