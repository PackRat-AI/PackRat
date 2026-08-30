import { z } from 'zod';
import { call } from '../client';
import { tool } from '../registerTool';
import type { AgentContext } from '../types';

export function registerSeasonTools(agent: AgentContext): void {
  // The description below deliberately does NOT advertise an inventory
  // prerequisite. It used to read "Requires at least 20 inventory items on
  // the signed-in user", and during an app-review run the model read that,
  // assumed a fresh account would not qualify, and silently skipped the tool
  // on a prompt that explicitly asked for season-appropriate packing —
  // answering from general web sources instead. Verified against the live
  // API on an account with no inventory: the endpoint returns full
  // suggestions regardless, so the warning was both self-defeating and wrong.
  //
  // If the endpoint does start refusing thin accounts, `call()` already maps
  // the failure to a structured error envelope the model can act on. Telling
  // it not to try is strictly worse than letting it try and handle a failure.
  tool<{ location: string; date: string }>(
    agent.server,
    'packrat_get_season_suggestions',
    {
      title: 'Get Season Suggestions',
      description:
        'Generate season-appropriate pack suggestions for a location and date — use this whenever the user asks what to pack for a place at a particular time of year. Returns ready-made pack suggestions with gear items chosen for the expected conditions.',
      inputSchema: {
        location: z.string().min(1).describe('Location string the API can geocode'),
        date: z.string().describe('ISO 8601 date or month label'),
      },
      annotations: {
        title: 'Get Season Suggestions',
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    async ({ location, date }) =>
      call({
        promise: agent.api.user['season-suggestions'].post({ location, date }),
        action: 'fetch season suggestions',
      }),
  );
}
