/**
 * U10 — MCP elicitations helper.
 *
 * Encapsulates the two elicitation patterns we use in PackRat:
 *
 *  1. `confirmAction` — used by destructive admin tools. Asks the user to
 *     type a specific string (e.g. `DELETE`, `PUBLISH`, or the target
 *     username) before the irreversible side-effect fires. Returns a
 *     structured `{ confirmed: boolean, reason? }` so each call site
 *     stays one line.
 *
 *  2. `chooseFromList` — used to disambiguate when a tool would otherwise
 *     guess between multiple candidates. Returns `{ chosen: string | null }`
 *     where `null` means the user cancelled / declined.
 *
 * Both helpers:
 *  - MUST pass `{ relatedRequestId: extra.requestId }` to `agent.elicitInput`.
 *    This is the agents@0.13 contract change documented in the U2 audit:
 *    without it, the elicitation request routes to a non-existent SSE
 *    stream and times out silently after 60s (see
 *    `node_modules/agents/dist/mcp/index.js`).
 *
 *  - MUST handle the "client doesn't support elicitations" case. The MCP
 *    SDK server (`@modelcontextprotocol/sdk/dist/esm/server/index.js`)
 *    throws `new Error('Client does not support elicitation (required for
 *    ${method})')` from `assertCapabilityForMethod` before the request
 *    ever leaves the server. We detect that exact substring and return a
 *    `reason: 'unsupported'` failure so each tool can downgrade to a
 *    clear error envelope rather than a generic protocol crash.
 *
 *  - MUST handle the "no active connections" case the agents SDK throws
 *    when the SSE stream has dropped. Same shape — we surface it as
 *    `reason: 'unsupported'` because functionally the client cannot
 *    receive the prompt either way.
 *
 *  - Treat the SDK's 60-second timeout (`Error: Elicitation request timed
 *    out`) as `reason: 'timeout'`. Distinct from `cancelled` because
 *    timeout often means the user closed the prompt without acting and a
 *    retry is meaningful, whereas `cancelled` is an explicit decline.
 *
 *  - Treat the user's `decline` action as `cancelled` for the purposes of
 *    the caller (both mean "do not proceed"). `accept` with the wrong
 *    confirmation string is `mismatch` so the caller can tell the model
 *    "the user typed the wrong thing, retry" vs "the user said no".
 *
 * Why a structural `ElicitCapable` rather than importing `McpAgent` directly?
 * Tool registration files only see `AgentContext` (see `types.ts` for the
 * rationale on avoiding the index → tools → index cycle). `AgentContext`
 * carries an optional `elicitInput` matching this shape; `PackRatMCP`
 * satisfies it structurally because `McpAgent.elicitInput` has the same
 * signature.
 */

import type { RequestId } from '@modelcontextprotocol/sdk/types.js';
import { isFunction, isString } from '@packrat/guards';

// ── Types ────────────────────────────────────────────────────────────────────

/**
 * Subset of the agents@0.13 `McpAgent.elicitInput` signature we depend on.
 * The full type lives in `node_modules/agents/dist/agent-tool-types-*.d.ts`;
 * we redeclare it here as a structural minimum so the helper doesn't drag
 * the full agents/mcp module graph (and its `cloudflare:workers` imports)
 * into Node-native vitest runs.
 */
export interface ElicitCapable {
  elicitInput(
    params: { message: string; requestedSchema: unknown },
    options?: { relatedRequestId?: RequestId },
  ): Promise<ElicitInputResult>;
}

/**
 * Permissive structural input the helpers accept. Both shapes work:
 *   - `{ elicitInput }`  — pass `agent` (the live `PackRatMCP`) directly,
 *     since `McpAgent.elicitInput` matches `ElicitCapable['elicitInput']`.
 *   - `{ elicitInput: undefined }` — test stubs / `AgentContext` without
 *     an agent. The helpers return `reason: 'unsupported'` immediately,
 *     mirroring the live-client missing-capability path.
 */
export type ElicitAgent = ElicitCapable | { elicitInput?: ElicitCapable['elicitInput'] };

/**
 * Mirror of `@modelcontextprotocol/sdk` `ElicitResult` shape. Defined
 * structurally to avoid the heavy types.js import path and keep the
 * helper unit-testable without standing up the full server.
 */
export interface ElicitInputResult {
  action: 'accept' | 'decline' | 'cancel';
  content?: Record<string, string | number | boolean | string[]>;
}

/**
 * Minimum subset of MCP `RequestHandlerExtra` we need. The full type
 * carries an AbortSignal, sessionId, authInfo, etc.; we only require
 * `requestId` so call sites can be tested without faking the rest.
 */
export interface ElicitExtra {
  requestId: RequestId;
}

export type ConfirmReason = 'mismatch' | 'cancelled' | 'timeout' | 'unsupported';

export type ConfirmResult = { confirmed: true } | { confirmed: false; reason: ConfirmReason };

export type ChooseResult = { chosen: string } | { chosen: null; reason: ConfirmReason };

// ── Internals ────────────────────────────────────────────────────────────────

/**
 * The MCP SDK throws this exact message from `assertCapabilityForMethod`
 * when the client didn't advertise the `elicitation` capability in its
 * `initialize` handshake. Match on the substring rather than the full
 * string because the SDK interpolates the method name into it
 * (`Client does not support elicitation (required for elicitation/create)`).
 */
const UNSUPPORTED_MESSAGE_SUBSTRING = 'does not support elicitation';

/**
 * The agents SDK throws this when no SSE/WebSocket connection is live to
 * deliver the request to. Functionally equivalent to "unsupported" from
 * the tool's perspective — the user cannot answer either way.
 */
const NO_CONNECTIONS_MESSAGE_SUBSTRING = 'No active connections available for elicitation';

/**
 * The agents SDK rejects with this message after 60s of no response. We
 * surface this distinctly from `cancelled` so the caller can tell apart
 * "user typed nothing for a minute" from "user clicked cancel".
 */
const TIMEOUT_MESSAGE_SUBSTRING = 'Elicitation request timed out';

function classifyElicitError(error: unknown): ConfirmReason {
  const message = error instanceof Error ? error.message : String(error);
  if (message.includes(UNSUPPORTED_MESSAGE_SUBSTRING)) return 'unsupported';
  if (message.includes(NO_CONNECTIONS_MESSAGE_SUBSTRING)) return 'unsupported';
  if (message.includes(TIMEOUT_MESSAGE_SUBSTRING)) return 'timeout';
  // Any other thrown error is treated as `unsupported` so the tool can
  // surface a clear "your client can't do this" message rather than
  // bubbling a raw protocol error up to the user.
  return 'unsupported';
}

// ── Public API ───────────────────────────────────────────────────────────────

export interface ConfirmActionOptions {
  /** Human-readable prompt shown to the user. */
  message: string;
  /** Exact string the user must type for `confirmed: true` (case-sensitive). */
  expectedConfirmation: string;
  /**
   * Optional label for the input field. Defaults to "Confirmation" so the
   * client UI shows something meaningful. Kept short so it renders well in
   * Claude Desktop's elicitation modal.
   */
  fieldLabel?: string;
}

/**
 * Open an elicitation that asks the user to type a specific string to
 * proceed with a destructive action. Returns `{ confirmed: true }` only
 * when the user typed the expected string verbatim.
 *
 * Failure reasons:
 *  - `'mismatch'`  — the user accepted but typed the wrong string.
 *  - `'cancelled'` — the user explicitly cancelled or declined.
 *  - `'timeout'`   — the SDK's 60s timeout fired with no response.
 *  - `'unsupported'` — the client never advertised the elicitation
 *     capability, no transport is live, or the SDK threw something we
 *     can't classify (treat as unsupported and let the tool degrade).
 */
// biome-ignore lint/complexity/useMaxParams: the (agent, extra, opts) trio mirrors the MCP server.elicitInput signature; collapsing into an options object would make each call site read as `confirmAction({ agent, extra, ...opts })` which is louder, not quieter.
export async function confirmAction(
  agent: ElicitAgent,
  extra: ElicitExtra,
  opts: ConfirmActionOptions,
): Promise<ConfirmResult> {
  if (!isFunction(agent.elicitInput)) {
    return { confirmed: false, reason: 'unsupported' };
  }
  const fieldLabel = opts.fieldLabel ?? 'Confirmation';
  let result: ElicitInputResult;
  try {
    result = await agent.elicitInput(
      {
        message: opts.message,
        // U10: a single-field schema. The `enum`-style "type the exact
        // word" pattern is not expressible in JSON Schema without a
        // const+pattern combo that some clients render poorly, so we
        // accept any string at the protocol level and validate the
        // exact match in this helper. Keeps the prompt simple in the UI.
        requestedSchema: {
          type: 'object',
          properties: {
            confirmation: {
              type: 'string',
              title: fieldLabel,
              description: `Type exactly: ${opts.expectedConfirmation}`,
            },
          },
          required: ['confirmation'],
        },
      },
      { relatedRequestId: extra.requestId },
    );
  } catch (error) {
    return { confirmed: false, reason: classifyElicitError(error) };
  }

  if (result.action === 'cancel' || result.action === 'decline') {
    return { confirmed: false, reason: 'cancelled' };
  }

  // action === 'accept' — verify the typed string matches.
  const typed = result.content?.confirmation;
  if (!isString(typed) || typed !== opts.expectedConfirmation) {
    return { confirmed: false, reason: 'mismatch' };
  }
  return { confirmed: true };
}

export interface ChooseFromListOptions {
  /** Human-readable prompt shown to the user. */
  message: string;
  /** Closed set of choices. The user picks exactly one. */
  choices: readonly string[];
  /** Optional label for the dropdown. Defaults to "Choice". */
  fieldLabel?: string;
}

/**
 * Open an elicitation that asks the user to pick one option from a closed
 * list. Returns `{ chosen: string }` on accept; `{ chosen: null, reason }`
 * on decline/cancel/timeout/unsupported.
 *
 * Uses a JSON-Schema `enum` on the `choice` property so the client UI
 * can render a dropdown rather than a free-text field.
 */
// biome-ignore lint/complexity/useMaxParams: matches the (agent, extra, opts) shape of confirmAction so both helpers read uniformly at call sites.
export async function chooseFromList(
  agent: ElicitAgent,
  extra: ElicitExtra,
  opts: ChooseFromListOptions,
): Promise<ChooseResult> {
  if (!isFunction(agent.elicitInput)) {
    return { chosen: null, reason: 'unsupported' };
  }
  const fieldLabel = opts.fieldLabel ?? 'Choice';
  let result: ElicitInputResult;
  try {
    result = await agent.elicitInput(
      {
        message: opts.message,
        requestedSchema: {
          type: 'object',
          properties: {
            choice: {
              type: 'string',
              title: fieldLabel,
              enum: [...opts.choices],
            },
          },
          required: ['choice'],
        },
      },
      { relatedRequestId: extra.requestId },
    );
  } catch (error) {
    return { chosen: null, reason: classifyElicitError(error) };
  }

  if (result.action === 'cancel' || result.action === 'decline') {
    return { chosen: null, reason: 'cancelled' };
  }

  const picked = result.content?.choice;
  if (!isString(picked) || !opts.choices.includes(picked)) {
    return { chosen: null, reason: 'mismatch' };
  }
  return { chosen: picked };
}
