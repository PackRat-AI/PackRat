/**
 * Auth tools.
 *
 * The MCP transport authenticates the user via OAuth 2.1, so MCP doesn't need
 * to implement email/password login itself. This module exposes only the
 * read-side of the auth surface a model may want to call:
 *
 *  - `whoami` — return the signed-in user profile.
 *
 * U5 removed the `admin_login` and `admin_logout` tools. Admin access is no
 * longer a runtime tool-mediated handshake: admin users acquire the
 * `mcp:admin` OAuth scope automatically at `/callback` time when their
 * Better Auth role resolves to `ADMIN`. See `packages/mcp/src/auth.ts`
 * (`handleCallback`), `packages/mcp/src/scopes.ts`, and the U5 section of
 * `docs/mcp/runbook.md` for the migration story.
 */

import { call } from '../client';
import type { AgentContext } from '../types';

export function registerAuthTools(agent: AgentContext): void {
  // ── Whoami ────────────────────────────────────────────────────────────────

  agent.server.registerTool(
    'whoami',
    {
      description: 'Return the currently authenticated PackRat user profile.',
      inputSchema: {},
    },
    async () => call(agent.api.user.user.profile.get(), { action: 'fetch profile' }),
  );
}
