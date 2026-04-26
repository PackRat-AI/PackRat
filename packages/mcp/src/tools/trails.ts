import { z } from 'zod';
import { err, ok } from '../client';
import type { AgentContext } from '../types';

export function registerTrailTools(agent: AgentContext): void {
  agent.server.registerTool(
    'preview_alltrails_url',
    {
      description:
        'Fetch trail metadata (title, description, image) from an AllTrails URL using OpenGraph tags. Use this to enrich a trip or pack with information from an AllTrails link a user shares.',
      inputSchema: {
        url: z.string().url().describe('Full AllTrails URL (must be https://alltrails.com/...)'),
      },
    },
    async ({ url }) => {
      try {
        const data = await agent.api.post('/alltrails/preview', { url });
        return ok(data);
      } catch (e) {
        return err(e);
      }
    },
  );
}
