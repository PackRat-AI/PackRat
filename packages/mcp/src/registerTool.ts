/**
 * Type-erasing wrapper around `McpServer.registerTool`.
 *
 * WHY: the SDK's `registerTool<OutputArgs, InputArgs>` overload resolves its
 * generics against the Zod v3 `ZodRawShape`/`ZodObject` of the in/out schemas
 * at EVERY call site. Measured cost: ~5.2M type-instantiations for a bare
 * one-field schema, ~15.2M once a real `outputSchema` is attached — and it
 * trips `TS2589` ("excessively deep"). Across ~104 tools that blows `tsc`
 * past 14 GB of heap, which is why the MCP type-check had to be disabled
 * (#2533).
 *
 * This wrapper instantiates that generic ONCE, here, against `never` (via the
 * two casts below), so each call site costs ~10 instantiations instead of
 * millions. Measured: the full package type-checks in <1 GB with no TS2589.
 *
 * Type safety is preserved, just moved off Zod inference and onto an explicit
 * per-tool arg type: `tool<{ pack_id: string }>(server, name, config, handler)`.
 * `TArgs` is enforced on the handler's args and `CallToolResult` on its return
 * (both produce real TS2322s on mismatch). The schemas remain runtime values,
 * so the SDK still validates inputs/outputs at call time exactly as before.
 */

import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { CallToolResult, GetPromptResult } from '@modelcontextprotocol/sdk/types.js';
import type { ZodRawShape } from 'zod';
import type { ElicitExtra } from './elicit';

/** The subset of `registerTool`'s config the PackRat tools use. */
export type ToolConfig = {
  title?: string;
  description?: string;
  inputSchema?: ZodRawShape;
  outputSchema?: ZodRawShape;
  annotations?: Record<string, unknown>;
};

/**
 * Register an MCP tool with an explicit `TArgs` input type (hand-written to
 * mirror `config.inputSchema`) instead of letting the SDK infer it from Zod —
 * see the file header for the why.
 */
// biome-ignore lint/complexity/useMaxParams: deliberately mirrors the SDK's own `registerTool(name, config, handler)` signature plus the `server` receiver. Collapsing to an options object would lose that 1:1 mapping and force rewriting 100+ call sites.
export function tool<TArgs>(
  server: McpServer,
  name: string,
  config: ToolConfig,
  handler: (args: TArgs, extra: ElicitExtra) => Promise<CallToolResult>,
): void {
  // safe-cast: this is the single, deliberate point where registerTool's
  // <OutputArgs, InputArgs> generic instantiates — against `never` rather than
  // the concrete recursive Zod shapes — collapsing ~5–15M instantiations per
  // call site to ~10. Runtime is unaffected (the real config/handler flow
  // through); only the compile-time inference is erased.
  server.registerTool(name, config as never, handler as never);
}

/** The subset of `registerPrompt`'s config the PackRat prompts use. */
export type PromptConfig = {
  title?: string;
  description?: string;
  argsSchema?: ZodRawShape;
};

/**
 * Register an MCP prompt with an explicit `TArgs` type, erasing the SDK's
 * `registerPrompt<PromptArgsRawShape>` generic the same way `tool` does — see
 * the file header. Without this, the prompts' Zod `argsSchema` resolves against
 * the SDK's bundled Zod (a different structural copy than the catalog Zod the
 * shapes are built with), which both inflates the instantiation count and
 * surfaces spurious TS2322s on `.optional()`/`.nativeEnum()` arg schemas.
 */
// biome-ignore lint/complexity/useMaxParams: mirrors the SDK's `registerPrompt(name, config, handler)` signature plus the `server` receiver, same as `tool` above.
export function prompt<TArgs>(
  server: McpServer,
  name: string,
  config: PromptConfig,
  handler: (args: TArgs, extra: ElicitExtra) => GetPromptResult | Promise<GetPromptResult>,
): void {
  // safe-cast: same single-point generic erasure as `tool` above, for prompts.
  server.registerPrompt(name, config as never, handler as never);
}
