/**
 * Review observability — per-tool-call telemetry for the MCP surface.
 *
 * WHY THIS EXISTS
 *
 * OpenAI rejected the first PackRat Apps submission with "some test cases
 * failed" and no per-case detail. We had no way to see what the reviewer's
 * session actually did, so we could not tell a genuine product bug from a
 * flaky upstream from a model that simply chose a different tool than the
 * one we declared in `chatgpt-app-submission.json`.
 *
 * This module makes a review session reconstructable after the fact:
 * which tools fired, in what order, how long each took, what came back,
 * and — on failure — the specific error code and upstream status.
 *
 * DESIGN CONSTRAINTS
 *
 * 1. `observability.ts` enforces a DEFAULT-DENY field allowlist. Any key
 *    emitted here that is not in `TOP_LEVEL_ALLOWLIST` silently becomes
 *    the string '[redacted]'. Every field this module emits is registered
 *    there under the "Review-observability surface" block. When adding a
 *    field, update both files in one commit — the failure mode is silent.
 *
 * 2. Logging must NEVER change tool behavior. Every emit path is wrapped
 *    so a telemetry bug degrades to "no log line" rather than "the
 *    reviewer's tool call threw". A broken logger must not fail a review.
 *
 * 3. No PII, no secrets, no free-text user content. We log argument KEYS
 *    but never argument VALUES (a trip name can carry a real location; a
 *    search query is user prose). Result previews are bounded and pass
 *    through `previewForLog`, which strips anything token-shaped.
 *
 * WHAT GETS EMITTED
 *
 *   mcp.tool.call    — one line per tool invocation (the primary artifact)
 *   mcp.tools.list   — snapshot of the tool listing the client actually saw
 *   mcp.session      — session lifecycle / client identification
 *   mcp.auth         — auth outcomes (see `auth-telemetry` usage in index.ts)
 *
 * Pivot on `sessionId` to get one ordered timeline; `seq` orders calls
 * within it. `correlationId` (cf-ray) ties a line back to the Cloudflare
 * zone log for the same request.
 */

import { isObject, isString } from '@packrat/guards';
import { safeJsonStringify } from '@packrat/utils';
import { createLogger, type Logger } from './observability';

/**
 * Max characters of a tool result we keep as a preview.
 *
 * Rationale: big enough to tell "returned a real forecast" from "returned
 * an empty array" — which is exactly the distinction a rejected test case
 * turns on — and small enough that a 60-call review session doesn't blow
 * up Workers Logs line limits. Tool payloads themselves can be up to
 * 150k chars (see RESPONSE_SIZE_LIMIT_CHARS in client.ts).
 */
export const PREVIEW_MAX_CHARS = 600;

/** Cap on how many tool names we enumerate in a `tools/list` snapshot. */
const MAX_LISTED_TOOL_NAMES = 200;

/**
 * Patterns that must never survive into a log line, even inside a preview.
 *
 * A tool result should never contain a credential — but "should never" is
 * not a guarantee we want to bet a compliance incident on, so previews are
 * filtered rather than trusted. Ordered most- to least-specific.
 */
const SENSITIVE_PATTERNS: readonly RegExp[] = [
  // JWTs (three base64url segments) — the highest-risk shape here, since
  // the whole worker traffics in them.
  /\beyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\b/g,
  // Bearer / token / secret / password credentials. The separator is
  // `[:=]` OR whitespace so both the JSON form (`"token": "abc..."`) and
  // the HTTP header form (`Authorization: Bearer abc...`) are caught — an
  // earlier version required a colon or equals and let the header form
  // through, which is the exact shape most likely to appear in an error
  // message echoed back from an upstream call.
  /\b(bearer|token|secret|password|api[_-]?key|refresh[_-]?token)\b["']?\s*[:=]?\s*["']?[A-Za-z0-9._-]{8,}["']?/gi,
  // Email addresses.
  /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/g,
];

const SENSITIVE_REPLACEMENT = '[redacted]';

/**
 * Reduce an arbitrary tool result to a bounded, secret-free preview string.
 *
 * Three stages: serialize → strip sensitive shapes → truncate. Truncation
 * happens LAST so a secret spanning the cut boundary is still caught by the
 * pattern pass (truncating first could split a JWT into an unmatched
 * fragment that then survives).
 *
 * Never throws: unserializable input degrades to a marker string. A
 * telemetry helper must not be able to fail a tool call.
 */
export function previewForLog(value: unknown): string {
  let text: string;
  try {
    text = isString(value) ? value : safeJsonStringify(value);
  } catch {
    return '[unserializable]';
  }
  if (!isString(text)) return '[unserializable]';
  let scrubbed = text;
  for (const pattern of SENSITIVE_PATTERNS) {
    scrubbed = scrubbed.replace(pattern, SENSITIVE_REPLACEMENT);
  }
  if (scrubbed.length <= PREVIEW_MAX_CHARS) return scrubbed;
  return `${scrubbed.slice(0, PREVIEW_MAX_CHARS)}…[+${scrubbed.length - PREVIEW_MAX_CHARS} chars]`;
}

/**
 * Extract the KEY NAMES of a tool's arguments — never the values.
 *
 * Knowing the model called `packrat_create_trip` with `{name, startDate,
 * location}` tells us the call was well-formed; knowing that location was
 * "Tuolumne Meadows" is user content we have no reason to store. Keys are
 * sorted so the same call shape produces a stable, diffable string across
 * runs.
 */
export function argKeysOf(args: unknown): string {
  if (!isObject(args)) return '';
  return Object.keys(args as Record<string, unknown>)
    .sort()
    .join(',');
}

/** Shape of a tool result we can read telemetry off of, without importing the SDK union. */
type ResultLike = {
  isError?: boolean;
  content?: unknown;
  structuredContent?: unknown;
};

/**
 * Pull the `error.code` out of the canonical `errResponse` envelope
 * (`structuredContent.error.code`, see client.ts). Returns undefined for
 * successful results or any shape that doesn't match — we never guess.
 */
function errorCodeOf(result: ResultLike): string | undefined {
  const structured = result.structuredContent;
  if (!isObject(structured)) return undefined;
  const error = (structured as Record<string, unknown>).error;
  if (!isObject(error)) return undefined;
  const code = (error as Record<string, unknown>).code;
  return isString(code) ? code : undefined;
}

/** Total characters across a result's text content blocks. */
function resultCharsOf(result: ResultLike): number {
  const content = result.content;
  if (!Array.isArray(content)) return 0;
  let total = 0;
  for (const block of content) {
    if (isObject(block)) {
      const text = (block as Record<string, unknown>).text;
      if (isString(text)) total += text.length;
    }
  }
  return total;
}

/** The text payload of a result, for previewing. */
function resultTextOf(result: ResultLike): unknown {
  const content = result.content;
  if (!Array.isArray(content) || content.length === 0) return result.structuredContent ?? null;
  const first = content[0];
  if (isObject(first)) {
    const text = (first as Record<string, unknown>).text;
    if (isString(text)) return text;
  }
  return first ?? null;
}

// ── Session-scoped emitter ───────────────────────────────────────────────────

export interface ToolCallOutcome {
  toolName: string;
  durationMs: number;
  args: unknown;
  /** The value the handler returned, or undefined when it threw. */
  result?: unknown;
  /** The thrown value, when the handler threw rather than returning an envelope. */
  thrown?: unknown;
}

/**
 * Per-session telemetry emitter.
 *
 * One instance lives on the Durable Object, so `seq` increments across the
 * whole session and every line shares a `sessionId`. That pairing is what
 * turns a pile of independent log lines into a readable transcript of what
 * the reviewer's session did, in order.
 */
export class ReviewTelemetry {
  private seq = 0;
  private readonly logger: Logger;

  constructor(private readonly sessionId: string) {
    this.logger = createLogger({ correlationId: sessionId, service: 'mcp' });
  }

  /**
   * Emit one `mcp.tool.call` line.
   *
   * Wrapped in a catch-all: a telemetry failure must never propagate into
   * the tool's return path. If we cannot log, we lose a line — we do not
   * lose the reviewer's tool call.
   */
  toolCall(outcome: ToolCallOutcome): void {
    try {
      this.seq += 1;
      const { toolName, durationMs, args, result, thrown } = outcome;

      if (thrown !== undefined) {
        // A throw is strictly worse than an `isError` envelope: it means the
        // handler broke rather than reporting a handled failure. Log it at
        // error level so it stands out when scanning a session.
        this.logger.error({
          msg: 'mcp.tool.call',
          fields: {
            sessionId: this.sessionId,
            seq: this.seq,
            toolName,
            durationMs,
            ok: false,
            isError: true,
            errorCode: 'handler_threw',
            argKeys: argKeysOf(args),
            preview: previewForLog(thrown instanceof Error ? thrown.message : thrown),
          },
        });
        return;
      }

      const envelope = (isObject(result) ? result : {}) as ResultLike;
      const isError = envelope.isError === true;
      const errorCode = errorCodeOf(envelope);
      const fields: Record<string, unknown> = {
        sessionId: this.sessionId,
        seq: this.seq,
        toolName,
        durationMs,
        ok: !isError,
        isError,
        argKeys: argKeysOf(args),
        resultChars: resultCharsOf(envelope),
        // Whether the tool emitted structuredContent. A tool that declares an
        // outputSchema but returns no structuredContent is a submission-review
        // risk in its own right, so it is worth seeing per call.
        structured: envelope.structuredContent !== undefined,
        preview: previewForLog(resultTextOf(envelope)),
      };
      if (errorCode) fields.errorCode = errorCode;

      if (isError) this.logger.warn({ msg: 'mcp.tool.call', fields });
      else this.logger.info({ msg: 'mcp.tool.call', fields });
    } catch {
      // Deliberately silent. See method docstring.
    }
  }

  /**
   * Snapshot the tool listing this session exposes.
   *
   * This is what the reviewer's client actually sees and grades against, so
   * a mismatch between this and `chatgpt-app-submission.json` is a direct
   * rejection cause. Emitted after the scope filter runs, so it reflects the
   * post-filter reality rather than what we registered.
   */
  toolsList(toolNames: readonly string[]): void {
    try {
      this.logger.info({
        msg: 'mcp.tools.list',
        fields: {
          sessionId: this.sessionId,
          toolCount: toolNames.length,
          toolNames: [...toolNames].sort().slice(0, MAX_LISTED_TOOL_NAMES).join(','),
        },
      });
    } catch {
      // Deliberately silent.
    }
  }

  /** Session lifecycle marker — pairs a sessionId with granted-scope count. */
  session(phase: string, fields: Record<string, unknown> = {}): void {
    try {
      this.logger.info({
        msg: 'mcp.session',
        fields: { sessionId: this.sessionId, phase, ...fields },
      });
    } catch {
      // Deliberately silent.
    }
  }
}
