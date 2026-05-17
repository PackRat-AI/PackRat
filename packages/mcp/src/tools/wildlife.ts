import { z } from 'zod';
import { call } from '../client';
import type { AgentContext } from '../types';

export function registerWildlifeTools(agent: AgentContext): void {
  agent.server.registerTool(
    'identify_wildlife',
    {
      description:
        'Identify the plant or animal species in an uploaded image (provide the R2 image key from upload_image_url).',
      inputSchema: { image_key: z.string() },
    },
    async ({ image_key }) =>
      call(agent.api.user.wildlife.identify.post({ image: image_key }), {
        action: 'identify wildlife',
      }),
  );
}
