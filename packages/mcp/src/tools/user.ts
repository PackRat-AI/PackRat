import { z } from 'zod';
import { call } from '../client';
import type { AgentContext } from '../types';

export function registerUserTools(agent: AgentContext): void {
  // ── Profile ───────────────────────────────────────────────────────────────

  agent.server.registerTool(
    'get_profile',
    {
      description: "Get the authenticated user's profile (firstName, lastName, email, avatar).",
      inputSchema: {},
    },
    async () => call(agent.api.user.user.profile.get(), { action: 'get profile' }),
  );

  agent.server.registerTool(
    'update_profile',
    {
      description: "Update the authenticated user's profile fields.",
      inputSchema: {
        first_name: z.string().min(1).optional(),
        last_name: z.string().min(1).optional(),
        email: z.string().email().optional(),
        avatar_url: z.string().url().optional(),
      },
    },
    async ({ first_name, last_name, email, avatar_url }) => {
      const body: Record<string, unknown> = {};
      if (first_name !== undefined) body.firstName = first_name;
      if (last_name !== undefined) body.lastName = last_name;
      if (email !== undefined) body.email = email;
      if (avatar_url !== undefined) body.avatarUrl = avatar_url;
      return call(agent.api.user.user.profile.put(body), { action: 'update profile' });
    },
  );
}
