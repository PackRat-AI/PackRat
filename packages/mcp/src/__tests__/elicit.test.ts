/**
 * U10 — unit tests for `confirmAction` / `chooseFromList` and the
 * agents@0.13 `relatedRequestId` contract.
 *
 * What's covered:
 *  - Every successful and failure-mode return shape for both helpers.
 *  - `confirmAction` round-trips the `expectedConfirmation` string verbatim.
 *  - The "client doesn't support elicitations" path: both the
 *    `assertCapabilityForMethod` error from `@modelcontextprotocol/sdk` and
 *    the "no active connections" error from `agents`. Each lands in
 *    `reason: 'unsupported'`.
 *  - Every call site passes `{ relatedRequestId: extra.requestId }` —
 *    asserted via a spy on `agent.elicitInput`. This is the load-bearing
 *    v0.13 contract change documented in U2.
 *  - The 60s SDK timeout surface (`Elicitation request timed out`) lands
 *    in `reason: 'timeout'` (distinct from `cancelled`).
 *
 * Why these tests and not transport-level integration tests?
 *  - The helpers are pure async functions over `elicitInput`. Spying on
 *    that one method gets us full coverage without a real Durable Object.
 *  - The unsupported-error contract is what the SDK actually throws — see
 *    `node_modules/@modelcontextprotocol/sdk/dist/esm/server/index.js`
 *    around the `assertCapabilityForMethod` branch. We assert on the
 *    substring rather than the full string so the SDK can interpolate
 *    method names without breaking the match.
 */

import type { RequestId } from '@modelcontextprotocol/sdk/types.js';
import { describe, expect, it, vi } from 'vitest';
import {
  chooseFromList,
  confirmAction,
  type ElicitCapable,
  type ElicitInputResult,
} from '../elicit';

// ── Test helpers ─────────────────────────────────────────────────────────────

function makeExtra(requestId: RequestId = 'req-1'): { requestId: RequestId } {
  return { requestId };
}

/**
 * Build an agent whose `elicitInput` resolves to the given result.
 * Returns both the agent and the spy so tests can assert call arguments.
 */
function agentResolving(result: ElicitInputResult): {
  agent: ElicitCapable;
  spy: ReturnType<typeof vi.fn>;
} {
  const spy = vi.fn().mockResolvedValue(result);
  return { agent: { elicitInput: spy } as unknown as ElicitCapable, spy };
}

function agentRejecting(err: unknown): {
  agent: ElicitCapable;
  spy: ReturnType<typeof vi.fn>;
} {
  const spy = vi.fn().mockRejectedValue(err);
  return { agent: { elicitInput: spy } as unknown as ElicitCapable, spy };
}

// ── confirmAction ────────────────────────────────────────────────────────────

describe('confirmAction', () => {
  it('returns { confirmed: true } when the user accepts with the expected string', async () => {
    const { agent } = agentResolving({
      action: 'accept',
      content: { confirmation: 'DELETE' },
    });
    const result = await confirmAction(agent, makeExtra(), {
      message: 'Type DELETE to proceed',
      expectedConfirmation: 'DELETE',
    });
    expect(result).toEqual({ confirmed: true });
  });

  it("returns reason 'mismatch' when the typed string doesn't match", async () => {
    const { agent } = agentResolving({
      action: 'accept',
      content: { confirmation: 'delete' }, // wrong case
    });
    const result = await confirmAction(agent, makeExtra(), {
      message: 'Type DELETE to proceed',
      expectedConfirmation: 'DELETE',
    });
    expect(result).toEqual({ confirmed: false, reason: 'mismatch' });
  });

  it("returns reason 'mismatch' when the confirmation field is missing", async () => {
    const { agent } = agentResolving({ action: 'accept' });
    const result = await confirmAction(agent, makeExtra(), {
      message: 'Type DELETE',
      expectedConfirmation: 'DELETE',
    });
    expect(result).toEqual({ confirmed: false, reason: 'mismatch' });
  });

  it("returns reason 'cancelled' on user cancel", async () => {
    const { agent } = agentResolving({ action: 'cancel' });
    const result = await confirmAction(agent, makeExtra(), {
      message: 'Type DELETE',
      expectedConfirmation: 'DELETE',
    });
    expect(result).toEqual({ confirmed: false, reason: 'cancelled' });
  });

  it("returns reason 'cancelled' on user decline (treated same as cancel)", async () => {
    const { agent } = agentResolving({ action: 'decline' });
    const result = await confirmAction(agent, makeExtra(), {
      message: 'Type DELETE',
      expectedConfirmation: 'DELETE',
    });
    expect(result).toEqual({ confirmed: false, reason: 'cancelled' });
  });

  it("returns reason 'unsupported' when the SDK throws 'does not support elicitation'", async () => {
    // This is the exact substring the MCP SDK's server.index.js throws from
    // `assertCapabilityForMethod` when the client never advertised the
    // `elicitation` capability in `initialize`.
    const { agent } = agentRejecting(
      new Error('Client does not support elicitation (required for elicitation/create)'),
    );
    const result = await confirmAction(agent, makeExtra(), {
      message: 'Type DELETE',
      expectedConfirmation: 'DELETE',
    });
    expect(result).toEqual({ confirmed: false, reason: 'unsupported' });
  });

  it("returns reason 'unsupported' when agents throws 'No active connections available'", async () => {
    // The agents SDK throws this when the SSE stream has dropped before
    // the elicitation can be delivered. Functionally equivalent to
    // unsupported from the tool's perspective.
    const { agent } = agentRejecting(new Error('No active connections available for elicitation'));
    const result = await confirmAction(agent, makeExtra(), {
      message: 'Type DELETE',
      expectedConfirmation: 'DELETE',
    });
    expect(result).toEqual({ confirmed: false, reason: 'unsupported' });
  });

  it("returns reason 'timeout' on the SDK's 60s elicitation timeout", async () => {
    const { agent } = agentRejecting(new Error('Elicitation request timed out'));
    const result = await confirmAction(agent, makeExtra(), {
      message: 'Type DELETE',
      expectedConfirmation: 'DELETE',
    });
    expect(result).toEqual({ confirmed: false, reason: 'timeout' });
  });

  it("falls back to 'unsupported' for unclassified thrown errors", async () => {
    const { agent } = agentRejecting(new Error('random transport blowup'));
    const result = await confirmAction(agent, makeExtra(), {
      message: 'Type DELETE',
      expectedConfirmation: 'DELETE',
    });
    expect(result).toEqual({ confirmed: false, reason: 'unsupported' });
  });

  it("returns reason 'unsupported' immediately when agent.elicitInput is undefined", async () => {
    // Mirrors the `AgentContext.elicitInput?` absence path — unit tests
    // build a stub agent without the method; the helper short-circuits
    // before touching the SDK.
    const result = await confirmAction({} as { elicitInput?: undefined }, makeExtra(), {
      message: 'Type DELETE',
      expectedConfirmation: 'DELETE',
    });
    expect(result).toEqual({ confirmed: false, reason: 'unsupported' });
  });

  it('passes { relatedRequestId: extra.requestId } to elicitInput (agents@0.13 contract)', async () => {
    const { agent, spy } = agentResolving({
      action: 'accept',
      content: { confirmation: 'DELETE' },
    });
    await confirmAction(agent, makeExtra('req-abc-123'), {
      message: 'Type DELETE',
      expectedConfirmation: 'DELETE',
    });
    expect(spy).toHaveBeenCalledTimes(1);
    const [params, options] = spy.mock.calls[0];
    expect(options).toEqual({ relatedRequestId: 'req-abc-123' });
    // Sanity: the schema is well-formed and the message is preserved.
    expect(params).toMatchObject({
      message: 'Type DELETE',
      requestedSchema: expect.objectContaining({ type: 'object' }),
    });
  });

  it('passes a numeric requestId through unchanged', async () => {
    const { agent, spy } = agentResolving({
      action: 'accept',
      content: { confirmation: 'X' },
    });
    await confirmAction(agent, makeExtra(42), {
      message: 'Type X',
      expectedConfirmation: 'X',
    });
    expect(spy.mock.calls[0][1]).toEqual({ relatedRequestId: 42 });
  });

  it('uses a custom fieldLabel in the requested schema', async () => {
    const { agent, spy } = agentResolving({
      action: 'accept',
      content: { confirmation: 'admin-user-1' },
    });
    await confirmAction(agent, makeExtra(), {
      message: 'Confirm delete',
      expectedConfirmation: 'admin-user-1',
      fieldLabel: 'User ID',
    });
    const [params] = spy.mock.calls[0];
    const properties = (
      params.requestedSchema as { properties: { confirmation: { title: string } } }
    ).properties;
    expect(properties.confirmation.title).toBe('User ID');
  });
});

// ── chooseFromList ───────────────────────────────────────────────────────────

describe('chooseFromList', () => {
  it('returns the chosen value when the user picks a valid option', async () => {
    const { agent } = agentResolving({
      action: 'accept',
      content: { choice: 'Yosemite Falls' },
    });
    const result = await chooseFromList(agent, makeExtra(), {
      message: 'Which trail?',
      choices: ['Yosemite Falls', 'Half Dome', 'Mist Trail'],
    });
    expect(result).toEqual({ chosen: 'Yosemite Falls' });
  });

  it('returns { chosen: null } on cancel', async () => {
    const { agent } = agentResolving({ action: 'cancel' });
    const result = await chooseFromList(agent, makeExtra(), {
      message: 'Which trail?',
      choices: ['A', 'B'],
    });
    expect(result).toEqual({ chosen: null, reason: 'cancelled' });
  });

  it('returns { chosen: null } on decline', async () => {
    const { agent } = agentResolving({ action: 'decline' });
    const result = await chooseFromList(agent, makeExtra(), {
      message: 'Pick one',
      choices: ['A'],
    });
    expect(result).toEqual({ chosen: null, reason: 'cancelled' });
  });

  it("returns reason 'mismatch' when the picked value is outside the choice set", async () => {
    // Pathological — but the helper guards against the client returning
    // a value that wasn't in the enum (some clients may free-text).
    const { agent } = agentResolving({
      action: 'accept',
      content: { choice: 'Mount Everest' },
    });
    const result = await chooseFromList(agent, makeExtra(), {
      message: 'Pick one',
      choices: ['A', 'B'],
    });
    expect(result).toEqual({ chosen: null, reason: 'mismatch' });
  });

  it("returns reason 'unsupported' when the SDK throws 'does not support elicitation'", async () => {
    const { agent } = agentRejecting(
      new Error('Client does not support elicitation (required for elicitation/create)'),
    );
    const result = await chooseFromList(agent, makeExtra(), {
      message: 'Pick one',
      choices: ['A'],
    });
    expect(result).toEqual({ chosen: null, reason: 'unsupported' });
  });

  it('passes { relatedRequestId } and emits a JSON-Schema enum on the choice property', async () => {
    const { agent, spy } = agentResolving({
      action: 'accept',
      content: { choice: 'A' },
    });
    await chooseFromList(agent, makeExtra('req-xyz'), {
      message: 'Pick',
      choices: ['A', 'B', 'C'],
    });
    const [params, options] = spy.mock.calls[0];
    expect(options).toEqual({ relatedRequestId: 'req-xyz' });
    const properties = (params.requestedSchema as { properties: { choice: { enum: string[] } } })
      .properties;
    expect(properties.choice.enum).toEqual(['A', 'B', 'C']);
  });

  it("returns reason 'unsupported' immediately when agent.elicitInput is undefined", async () => {
    const result = await chooseFromList({} as { elicitInput?: undefined }, makeExtra(), {
      message: 'Pick',
      choices: ['A'],
    });
    expect(result).toEqual({ chosen: null, reason: 'unsupported' });
  });
});
