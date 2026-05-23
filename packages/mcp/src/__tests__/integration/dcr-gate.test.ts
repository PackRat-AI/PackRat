/**
 * Live-Worker integration tests for the U4 DCR gate (`POST /register`).
 *
 * **Deferred (U17 follow-up):** see `./well-known.test.ts` for the
 * full deferral rationale — same `ajv`-in-workerd blocker.
 *
 * Unit-level coverage of `dcrRegisterGate` lives in `../auth.test.ts`
 * and exercises every rejection + pass-through branch directly (no
 * Worker boot). The cases below are the end-to-end smoke that should
 * land once the harness can stand up the full Worker — they prove the
 * gate actually fires *above* the OAuth provider's built-in
 * `/register` handler (a load-bearing ordering U4 specifically called
 * out).
 */

import { describe, it } from 'vitest';

describe('DCR gate on POST /register (integration — deferred per U17 follow-up)', () => {
  it.todo('POST /register without an Authorization header returns 401');

  it.todo('POST /register with a wrong bearer returns 401');

  it.todo(
    'POST /register with the correct bearer is passed through to the OAuth provider ' +
      'and returns 201 with the registration body',
  );
});
