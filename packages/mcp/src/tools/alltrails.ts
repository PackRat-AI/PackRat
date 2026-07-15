import { z } from 'zod';
import { call } from '../client';
import { tool } from '../registerTool';
import type { AgentContext } from '../types';

export function registerAlltrailsTools(agent: AgentContext): void {
  tool<{ url: string }>(
    agent.server,
    'packrat_preview_alltrails_url',
    {
      title: 'Preview AllTrails URL',
      description:
        'Fetch trail metadata (title, description, image) from an AllTrails URL using OpenGraph tags.',
      inputSchema: { url: z.string().url() },
      annotations: {
        title: 'Preview AllTrails URL',
        readOnlyHint: true,
        idempotentHint: false,
        openWorldHint: true,
      },
    },
    async ({ url }) =>
      call({
        promise: agent.api.user.alltrails.preview.post({ url }),
        action: 'preview AllTrails URL',
        resourceHint: url,
      }),
  );
}
