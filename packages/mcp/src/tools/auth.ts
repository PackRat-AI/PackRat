/**
 * Auth tools.
 *
 * The MCP transport authenticates the user via OAuth 2.1, so MCP doesn't need
 * to implement email/password login itself. These tools expose the parts of
 * the auth surface a model may want to call:
 *
 *  - `whoami` — return the signed-in user profile.
 *  - `admin_login` — exchange Basic credentials for a short-lived admin JWT
 *    and store it on the session so admin tools can use it.
 *  - `admin_logout` — clear the stored admin JWT.
 */

import { isObject } from '@packrat/guards';
import { z } from 'zod';
import { call, errMessage, ok } from '../client';
import type { AgentContext } from '../types';

export function registerAuthTools(agent: AgentContext): void {
  // ── Whoami ────────────────────────────────────────────────────────────────

  agent.server.registerTool(
    'whoami',
    {
      description: 'Return the currently authenticated PackRat user profile.',
      inputSchema: {},
    },
    async () => call({ promise: agent.api.user.user.profile.get(), action: 'fetch profile' }),
  );

  // ── Admin login ───────────────────────────────────────────────────────────
  // Uses the body-credential variant of /api/admin/token (POST /admin/login)
  // so the call goes straight through Treaty — no Basic-header bypass.

  agent.server.registerTool(
    'admin_login',
    {
      description:
        'Exchange admin credentials (username + password) for a short-lived admin JWT and store it for the current MCP session. Required before calling any admin_* tool unless an admin JWT was already supplied via the X-PackRat-Admin-Token header.',
      inputSchema: {
        username: z.string().min(1),
        password: z.string().min(1),
      },
    },
    async ({ username, password }) => {
      const result = await agent.api.user.admin.login.post({ username, password });
      if (result.error || !result.data) {
        const detail = isObject(result.error) ? (result.error.value ?? null) : null;
        return errMessage(
          `Admin login failed (HTTP ${result.status})${detail ? `: ${JSON.stringify(detail)}` : ''}`,
        );
      }
      agent.setAdminToken(result.data.token);
      return ok({ ok: true, expiresIn: result.data.expiresIn });
    },
  );

  // ── Admin logout / clear token ────────────────────────────────────────────

  agent.server.registerTool(
    'admin_logout',
    {
      description: 'Clear the stored admin JWT for this MCP session.',
      inputSchema: {},
    },
    async () => {
      agent.setAdminToken('');
      return ok({ ok: true });
    },
  );
}
