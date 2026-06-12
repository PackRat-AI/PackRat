/**
 * Real unit tests for the auth tool handler
 * (`packages/mcp/src/tools/auth.ts`).
 *
 * `packrat_whoami` declares an `outputSchema` and opts into structured
 * emission (`structured: true`), so the handler returns both a text-content
 * envelope and a `structuredContent` payload mirroring the API `data`.
 */

import { describe, expect, it } from 'vitest';
import { registerAuthTools } from '../tools/auth';
import type { ApiCall } from './_tool-harness';
import { firstText, getToolHandler, makeAgent, makeExtra } from './_tool-harness';

/** True when a recorded call's path ends with the given trailing segments. */
function endsWith(call: ApiCall, segments: string[]): boolean {
  const tail = call.path.slice(-segments.length);
  return tail.length === segments.length && tail.every((seg, i) => seg === segments[i]);
}

describe('packrat_whoami', () => {
  it('GETs user.user.profile and returns a structured text envelope', async () => {
    const { agent, server, calls } = makeAgent();
    registerAuthTools(agent);

    const result = await getToolHandler(server, 'packrat_whoami')({}, makeExtra());

    expect(result.content[0]?.type).toBe('text');
    expect(firstText(result).length).toBeGreaterThan(0);
    expect(result.structuredContent).toEqual({ success: true });
    expect(calls.filter((c) => endsWith(c, ['user', 'profile', 'get']))).toHaveLength(1);
  });
});
