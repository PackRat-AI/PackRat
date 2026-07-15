/**
 * Real unit tests for the user-profile tool handlers
 * (`packages/mcp/src/tools/user.ts`).
 *
 * Each test registers the tools against the shared stub agent, invokes the
 * handler directly, and asserts both the text-content envelope AND that the
 * expected Treaty endpoint (specific path segments + terminal verb) was hit
 * on the recorded `calls`.
 */

import { describe, expect, it } from 'vitest';
import { registerUserTools } from '../tools/user';
import type { ApiCall } from './_tool-harness';
import { firstText, getToolHandler, makeAgent, makeExtra } from './_tool-harness';

/** True when a recorded call's path ends with the given trailing segments. */
function endsWith(call: ApiCall, segments: string[]): boolean {
  const tail = call.path.slice(-segments.length);
  return tail.length === segments.length && tail.every((seg, i) => seg === segments[i]);
}

describe('packrat_get_profile', () => {
  it('GETs user.user.profile and returns a text envelope', async () => {
    const { agent, server, calls } = makeAgent();
    registerUserTools(agent);

    const result = await getToolHandler(server, 'packrat_get_profile')({}, makeExtra());

    expect(result.content[0]?.type).toBe('text');
    expect(firstText(result).length).toBeGreaterThan(0);
    expect(calls.filter((c) => endsWith(c, ['user', 'profile', 'get']))).toHaveLength(1);
  });
});

describe('packrat_update_profile', () => {
  it('PUTs the camelCased profile body to user.user.profile', async () => {
    const { agent, server, calls } = makeAgent();
    registerUserTools(agent);

    const result = await getToolHandler(server, 'packrat_update_profile')(
      { first_name: 'Ada', last_name: 'Lovelace', email: 'ada@example.com' },
      makeExtra(),
    );

    expect(result.content[0]?.type).toBe('text');
    expect(firstText(result).length).toBeGreaterThan(0);

    const puts = calls.filter((c) => endsWith(c, ['user', 'profile', 'put']));
    expect(puts).toHaveLength(1);
    expect(puts[0]?.args[0]).toEqual({
      firstName: 'Ada',
      lastName: 'Lovelace',
      email: 'ada@example.com',
    });
  });

  it('omits undefined fields from the PUT body', async () => {
    const { agent, server, calls } = makeAgent();
    registerUserTools(agent);

    await getToolHandler(server, 'packrat_update_profile')(
      { avatar_url: 'https://example.com/a.png' },
      makeExtra(),
    );

    const puts = calls.filter((c) => endsWith(c, ['user', 'profile', 'put']));
    expect(puts).toHaveLength(1);
    expect(puts[0]?.args[0]).toEqual({ avatarUrl: 'https://example.com/a.png' });
  });
});
