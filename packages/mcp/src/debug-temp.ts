/**
 * ⚠️ TEMPORARY DEBUG INSTRUMENTATION — REMOVE BEFORE SHIP ⚠️
 *
 * Comprehensive, raw debug logging for the tools we're currently
 * investigating for flakiness over the Cloudflare-tunnel setup:
 *
 *   - group 1 (semantic/similarity/suggestions):
 *       packrat_semantic_gear_search, packrat_similar_catalog_items,
 *       packrat_similar_pack_items, packrat_suggest_pack_items
 *   - weather: packrat_get_weather, packrat_search_weather_location,
 *       packrat_search_weather_by_coordinates, packrat_get_weather_forecast
 *   - packrat_analyze_pack_gaps
 *   - packrat_analyze_pack_image
 *   - guides tools
 *   - packrat_get_season_suggestions
 *
 * Why raw `console.*` and NOT the structured `createLogger`:
 * `observability.ts`'s `scrubFields` applies a default-deny allowlist, so
 * tool inputs / upstream query params / response payloads would all be
 * redacted to `[redacted]`. For debugging we need the ACTUAL values, so we
 * bypass the allowlist deliberately here. Every line is prefixed with
 * `[MCP-DEBUG]` so it is trivially greppable and removable — delete this
 * file and its imports to fully revert.
 *
 * These logs may contain user input and upstream payloads — acceptable for
 * short-lived local tunnel debugging, NOT for production. Do not deploy.
 */

const PREFIX = '[MCP-DEBUG]';

/** Safe stringify that never throws and truncates huge payloads. */
function safe(value: unknown): string {
  try {
    const s = typeof value === 'string' ? value : JSON.stringify(value);
    if (s == null) return String(value);
    return s.length > 4000 ? `${s.slice(0, 4000)}…(truncated ${s.length} chars)` : s;
  } catch {
    return String(value);
  }
}

/**
 * Log an outbound upstream API call (path label + query/body). The repo caps
 * functions at 2 positional params, so `tool` + a single details object.
 */
export function dbgUpstream(tool: string, details: { label: string; payload?: unknown }): void {
  console.log(`${PREFIX} ↗ ${tool} upstream=${details.label} payload=${safe(details.payload)}`);
}

/** Read the MCP result envelope structurally (avoids a circular type import). */
function envelope(result: unknown): { ok: boolean; text?: string; structured?: unknown } {
  const r = (result ?? {}) as {
    isError?: boolean;
    content?: { text?: string }[];
    structuredContent?: unknown;
  };
  return { ok: r.isError !== true, text: r.content?.[0]?.text, structured: r.structuredContent };
}

/**
 * Wrap a tool handler with start / end / throw debug logging. Preserves the
 * handler's argument shape (`(input, extra) => Promise<result>`).
 */
export function withDebug<A extends unknown[], R>(
  tool: string,
  handler: (...args: A) => Promise<R>,
): (...args: A) => Promise<R> {
  return async (...args: A): Promise<R> => {
    const startedAt = Date.now();
    console.log(`${PREFIX} ▶ ${tool} start input=${safe(args[0])}`);
    try {
      const result = await handler(...args);
      const ms = Date.now() - startedAt;
      const { ok, text, structured } = envelope(result);
      console.log(
        `${PREFIX} ${ok ? '✔' : '✖'} ${tool} end ok=${ok} ms=${ms} ` +
          `text=${safe(text)} structured=${safe(structured)}`,
      );
      return result;
    } catch (err) {
      const ms = Date.now() - startedAt;
      const message = err instanceof Error ? `${err.name}: ${err.message}` : String(err);
      const stack = err instanceof Error ? err.stack : undefined;
      console.error(`${PREFIX} 💥 ${tool} threw ms=${ms} err=${message} stack=${safe(stack)}`);
      throw err;
    }
  };
}
