import { z } from 'zod';
import { call } from '../client';
import { tool } from '../registerTool';
import type { AgentContext } from '../types';

export function registerUserTools(agent: AgentContext): void {
  // ── Profile ───────────────────────────────────────────────────────────────

  tool<Record<string, never>>(
    agent.server,
    'packrat_get_profile',
    {
      title: 'Get My Profile',
      description: "Get the authenticated user's profile (firstName, lastName, email, avatar).",
      inputSchema: {},
      annotations: {
        title: 'Get My Profile',
        readOnlyHint: true,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    async () => call({ promise: agent.api.user.user.profile.get(), action: 'get profile' }),
  );

  tool<{
    first_name?: string;
    last_name?: string;
    email?: string;
    avatar_url?: string;
  }>(
    agent.server,
    'packrat_update_profile',
    {
      title: 'Update My Profile',
      description: "Update the authenticated user's profile fields.",
      inputSchema: {
        first_name: z.string().min(1).optional(),
        last_name: z.string().min(1).optional(),
        email: z.string().email().optional(),
        avatar_url: z.string().url().optional(),
      },
      annotations: {
        title: 'Update My Profile',
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    async ({ first_name, last_name, email, avatar_url }) => {
      const body: Record<string, unknown> = {};
      if (first_name !== undefined) body.firstName = first_name;
      if (last_name !== undefined) body.lastName = last_name;
      if (email !== undefined) body.email = email;
      if (avatar_url !== undefined) body.avatarUrl = avatar_url;
      return call({ promise: agent.api.user.user.profile.put(body), action: 'update profile' });
    },
  );
}
