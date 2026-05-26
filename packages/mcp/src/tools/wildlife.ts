import { z } from 'zod';
import { call } from '../client';
import type { AgentContext } from '../types';

export function registerWildlifeTools(agent: AgentContext): void {
  agent.server.registerTool(
    'packrat_identify_wildlife',
    {
      title: 'Identify Wildlife From Image',
      description:
        'Identify the plant or animal species in an uploaded image (provide the R2 image key from packrat_upload_image_url).',
      inputSchema: { image_key: z.string() },
      annotations: {
        title: 'Identify Wildlife From Image',
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: false,
        openWorldHint: false,
      },
    },
    async ({ image_key }) =>
      call({
        promise: agent.api.user.wildlife.identify.post({ image: image_key }),
        action: 'identify wildlife',
      }),
  );
}
