/**
 * U16 — review-observability telemetry tests.
 *
 * The load-bearing test in this file is the allowlist round-trip
 * (`every emitted field survives scrubFields`). `observability.ts` enforces
 * a DEFAULT-DENY allowlist that silently rewrites unlisted keys to the
 * string '[redacted]' — no throw, no warning. Without this test, adding a
 * telemetry field and forgetting the allowlist entry produces a deploy that
 * looks fine locally and yields a useless log full of '[redacted]' during
 * the one OpenAI review window we care about.
 *
 * The rest of the suite covers the two properties telemetry must never
 * violate: it must not leak secrets, and it must not be able to break a
 * tool call.
 */

import { describe, expect, it } from 'vitest';
import { scrubFields } from '../observability';
import { argKeysOf, PREVIEW_MAX_CHARS, previewForLog, ReviewTelemetry } from '../telemetry';

type CapturedLine = { level: 'log' | 'warn' | 'error'; json: Record<string, unknown> };

/** Capture console output as parsed JSON lines. */
function captureLogs(): { lines: CapturedLine[]; restore: () => void } {
  const lines: CapturedLine[] = [];
  const original = { log: console.log, warn: console.warn, error: console.error };
  const push = (level: CapturedLine['level']) => (msg: unknown) => {
    lines.push({
      level,
      json: typeof msg === 'string' ? JSON.parse(msg) : (msg as Record<string, unknown>),
    });
  };
  console.log = push('log');
  console.warn = push('warn');
  console.error = push('error');
  return {
    lines,
    restore: () => {
      console.log = original.log;
      console.warn = original.warn;
      console.error = original.error;
    },
  };
}

describe('previewForLog', () => {
  it('strips JWT-shaped strings so a leaked token never reaches the log', () => {
    const jwt =
      'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.dBjftJeZ4CVPmB92K27uhbUJU1p1r_wW1gFWFOEjXk';
    const out = previewForLog({ token: jwt });
    expect(out).not.toContain('eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9');
    expect(out).toContain('[redacted]');
  });

  it('strips email addresses', () => {
    const out = previewForLog({ note: 'contact reviewer@openai.com for details' });
    expect(out).not.toContain('reviewer@openai.com');
    expect(out).toContain('[redacted]');
  });

  it('strips bearer/secret assignments regardless of casing', () => {
    const out = previewForLog('Authorization: Bearer abcdef1234567890');
    expect(out).not.toContain('abcdef1234567890');
  });

  it('truncates long payloads and reports how much was dropped', () => {
    const out = previewForLog('x'.repeat(PREVIEW_MAX_CHARS + 500));
    expect(out.length).toBeLessThan(PREVIEW_MAX_CHARS + 60);
    expect(out).toContain('+500 chars');
  });

  it('scrubs before truncating, so a secret at the cut boundary cannot survive', () => {
    // A JWT positioned to straddle PREVIEW_MAX_CHARS. If truncation ran
    // first it would split the token into an unmatched fragment that the
    // pattern pass would then miss.
    const jwt =
      'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.dBjftJeZ4CVPmB92K27uhbUJU1p1r_wW1gFWFOEjXk';
    const padded = 'a'.repeat(PREVIEW_MAX_CHARS - 20) + jwt;
    const out = previewForLog(padded);
    expect(out).not.toContain('eyJzdWIiOiIxMjM0NTY3ODkwIn0');
  });

  it('degrades to a marker rather than throwing on circular input', () => {
    const circular: Record<string, unknown> = {};
    circular.self = circular;
    expect(() => previewForLog(circular)).not.toThrow();
  });
});

describe('argKeysOf', () => {
  it('returns sorted key names and never the values', () => {
    const out = argKeysOf({ location: 'Tuolumne Meadows', days: 3, name: 'Yosemite trip' });
    expect(out).toBe('days,location,name');
    expect(out).not.toContain('Tuolumne');
    expect(out).not.toContain('Yosemite');
  });

  it('returns an empty string for non-object args', () => {
    expect(argKeysOf(undefined)).toBe('');
    expect(argKeysOf('a string')).toBe('');
  });
});

describe('ReviewTelemetry', () => {
  it('emits an ordered mcp.tool.call line per invocation', () => {
    const cap = captureLogs();
    try {
      const t = new ReviewTelemetry('session:abc');
      t.toolCall({
        toolName: 'packrat_get_weather',
        durationMs: 42,
        args: { location: 'Yosemite' },
        result: { content: [{ type: 'text', text: '{"forecast":"sunny"}' }] },
      });
      t.toolCall({
        toolName: 'packrat_create_trip',
        durationMs: 88,
        args: { name: 'trip' },
        result: { content: [{ type: 'text', text: '{"id":"t_1"}' }] },
      });

      const calls = cap.lines.filter((l) => l.json.msg === 'mcp.tool.call');
      expect(calls).toHaveLength(2);
      expect(calls[0]?.json.toolName).toBe('packrat_get_weather');
      expect(calls[0]?.json.seq).toBe(1);
      expect(calls[0]?.json.ok).toBe(true);
      expect(calls[0]?.json.durationMs).toBe(42);
      // seq must increment so a transcript can be reconstructed in order.
      expect(calls[1]?.json.seq).toBe(2);
      expect(calls[1]?.json.toolName).toBe('packrat_create_trip');
    } finally {
      cap.restore();
    }
  });

  it('surfaces the error code from an errResponse envelope at warn level', () => {
    const cap = captureLogs();
    try {
      new ReviewTelemetry('session:abc').toolCall({
        toolName: 'packrat_list_packs',
        durationMs: 10,
        args: {},
        result: {
          isError: true,
          content: [{ type: 'text', text: 'Rate limit exceeded' }],
          structuredContent: {
            error: { code: 'rate_limited', message: 'slow down', retryable: true },
          },
        },
      });
      const line = cap.lines.find((l) => l.json.msg === 'mcp.tool.call');
      expect(line?.level).toBe('warn');
      expect(line?.json.ok).toBe(false);
      expect(line?.json.isError).toBe(true);
      expect(line?.json.errorCode).toBe('rate_limited');
    } finally {
      cap.restore();
    }
  });

  it('records a thrown handler at error level as handler_threw', () => {
    const cap = captureLogs();
    try {
      new ReviewTelemetry('session:abc').toolCall({
        toolName: 'packrat_broken',
        durationMs: 5,
        args: {},
        thrown: new Error('kaboom'),
      });
      const line = cap.lines.find((l) => l.json.msg === 'mcp.tool.call');
      expect(line?.level).toBe('error');
      expect(line?.json.errorCode).toBe('handler_threw');
      expect(line?.json.preview).toContain('kaboom');
    } finally {
      cap.restore();
    }
  });

  it('emits a tools/list snapshot with a sorted, counted name list', () => {
    const cap = captureLogs();
    try {
      new ReviewTelemetry('session:abc').toolsList(['packrat_b', 'packrat_a']);
      const line = cap.lines.find((l) => l.json.msg === 'mcp.tools.list');
      expect(line?.json.toolCount).toBe(2);
      expect(line?.json.toolNames).toBe('packrat_a,packrat_b');
    } finally {
      cap.restore();
    }
  });

  it('never throws when the underlying console fails', () => {
    const original = console.log;
    console.log = () => {
      throw new Error('logging is broken');
    };
    try {
      const t = new ReviewTelemetry('session:abc');
      // A telemetry failure must degrade to a missing line, never propagate
      // into the tool's return path and fail a reviewer's call.
      expect(() =>
        t.toolCall({ toolName: 'x', durationMs: 1, args: {}, result: { content: [] } }),
      ).not.toThrow();
      expect(() => t.toolsList(['a'])).not.toThrow();
      expect(() => t.session('init')).not.toThrow();
    } finally {
      console.log = original;
    }
  });
});

describe('allowlist round-trip (guards the silent-redaction trap)', () => {
  /**
   * Every field name this package emits. If a field is added to a log call
   * without a matching `TOP_LEVEL_ALLOWLIST` entry in observability.ts,
   * `scrubFields` rewrites it to '[redacted]' silently — this test is the
   * only thing that catches that before it reaches production.
   */
  const EMITTED_FIELDS: Record<string, unknown> = {
    sessionId: 'session:abc',
    phase: 'init',
    seq: 1,
    durationMs: 42,
    ok: true,
    isError: false,
    errorCode: 'rate_limited',
    resultChars: 100,
    structured: true,
    truncated: false,
    argKeys: 'a,b',
    preview: 'some preview text',
    toolCount: 12,
    toolNames: 'packrat_a,packrat_b',
    protocolVersion: '2025-06-18',
    clientName: 'openai-apps',
    clientVersion: '1.0.0',
    upstreamStatus: 503,
    upstreamOperation: 'list packs',
    httpStatus: 401,
    authEvent: 'verified',
    authOk: true,
    authReason: 'token_rejected',
    scopeCount: 2,
    hasToken: true,
    toolName: 'packrat_get_weather',
    retryable: true,
    method: 'POST',
    path: '/mcp',
  };

  it('preserves every emitted field through scrubFields', () => {
    const scrubbed = scrubFields(EMITTED_FIELDS);
    const redacted = Object.entries(scrubbed)
      .filter(([, v]) => v === '[redacted]')
      .map(([k]) => k);
    expect(redacted).toEqual([]);
  });

  it('still redacts a field that was never allowlisted', () => {
    // Proves the test above is meaningful — the allowlist is genuinely
    // default-deny and this suite would catch a missing entry.
    const scrubbed = scrubFields({ somethingNeverAllowlisted: 'value' });
    expect(scrubbed.somethingNeverAllowlisted).toBe('[redacted]');
  });
});
