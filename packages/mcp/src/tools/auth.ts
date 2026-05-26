/**
 * Auth tools.
 *
 * The MCP transport authenticates the user via OAuth 2.1, so MCP doesn't need
 * to implement email/password login itself. This module exposes only the
 * read-side of the auth surface a model may want to call:
 *
 *  - `packrat_whoami` — return the signed-in user profile.
 *
 * U5 removed the `admin_login` and `admin_logout` tools. Admin access is no
 * longer a runtime tool-mediated handshake: admin users acquire the
 * `mcp:admin` OAuth scope automatically at token-issuance time when their
 * Better Auth role resolves to `ADMIN` (issuance lives in the API worker
 * via `@better-auth/oauth-provider` after U3+U4). See
 * `packages/mcp/src/scopes.ts` and the U5/U7 sections of
 * `docs/mcp/runbook.md` for the migration story.
 *
 * U7 namespaced every tool with the `packrat_` prefix and added the
 * connector-store annotations (`title`, `readOnlyHint`, `destructiveHint`,
 * `idempotentHint`, `openWorldHint`) explicitly on every tool so the SDK's
 * `destructiveHint: true` default never quietly forces a confirmation
 * prompt on a read-only tool.
 */

import { call } from '../client';
import { WhoAmIOutputSchema } from '../output-schemas';
import type { AgentContext } from '../types';

export function registerAuthTools(agent: AgentContext): void {
  // ── Whoami ────────────────────────────────────────────────────────────────

  agent.server.registerTool(
    'packrat_whoami',
    {
      title: 'Who Am I',
      description: 'Return the currently authenticated PackRat user profile.',
      inputSchema: {},
      // U8: declare the structured-output shape so clients can consume
      // the user profile without reparsing the text block. The handler
      // opts into structured emission via `{ structured: true }`.
      outputSchema: WhoAmIOutputSchema.shape,
      annotations: {
        title: 'Who Am I',
        readOnlyHint: true,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    async () =>
      call(agent.api.user.user.profile.get(), { action: 'fetch profile', structured: true }),
  );
}
