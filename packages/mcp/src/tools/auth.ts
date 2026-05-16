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
    async () => call(agent.api.user.user.profile.get(), { action: 'fetch profile' }),
  );

  // ── Admin login ───────────────────────────────────────────────────────────
  // POST /api/admin/token uses HTTP Basic auth — hit it via fetch rather than
  // Treaty so we can attach the Basic header without disturbing the admin
  // Treaty client's Bearer header.

  agent.server.registerTool(
    'admin_login',
    {
      description:
        'Exchange admin Basic credentials (username + password) for a short-lived admin JWT and store it for the current MCP session. Required before calling any admin_* tool unless an admin JWT was already supplied via the X-PackRat-Admin-Token header.',
      inputSchema: {
        username: z.string().min(1),
        password: z.string().min(1),
      },
    },
    async ({ username, password }) => {
      const basic = btoa(`${username}:${password}`);
      const response = await fetch(`${agent.apiBaseUrl}/api/admin/token`, {
        method: 'POST',
        headers: { Authorization: `Basic ${basic}`, 'Content-Type': 'application/json' },
        body: '{}',
      });
      const body = (await response.json().catch(() => null)) as {
        token?: string;
        expiresIn?: number;
        error?: string;
      } | null;
      if (!response.ok || !body?.token) {
        return errMessage(
          `Admin login failed (HTTP ${response.status})${body?.error ? `: ${body.error}` : ''}`,
        );
      }
      agent.setAdminToken(body.token);
      return ok({ ok: true, expiresIn: body.expiresIn });
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
