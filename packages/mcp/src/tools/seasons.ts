import { z } from 'zod';
import { call } from '../client';
import type { AgentContext } from '../types';

export function registerSeasonTools(agent: AgentContext): void {
  // Note: the API requires a user with 20+ inventory items before serving
  // suggestions — the call may 422 for new users.
  agent.server.registerTool(
    'packrat_get_season_suggestions',
    {
      title: 'Get Season Suggestions',
      description:
        'Generate season-appropriate pack suggestions for a location + date. Requires at least 20 inventory items on the signed-in user.',
      inputSchema: {
        location: z.string().min(1).describe('Location string the API can geocode'),
        date: z.string().describe('ISO 8601 date or month label'),
      },
      annotations: {
        title: 'Get Season Suggestions',
        readOnlyHint: true,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    async ({ location, date }) =>
      call(agent.api.user['season-suggestions'].post({ location, date }), {
        action: 'fetch season suggestions',
      }),
  );
}
