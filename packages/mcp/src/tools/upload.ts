import { z } from 'zod';
import { call } from '../client';
import type { AgentContext } from '../types';

export function registerUploadTools(agent: AgentContext): void {
  agent.server.registerTool(
    'packrat_upload_image_url',
    {
      title: 'Create Image Upload URL',
      description:
        'Generate a presigned R2 URL the caller can PUT an image to (jpeg/png/webp, ≤10MB). Returns { uploadUrl, key } — use `key` in downstream tools (packrat_analyze_pack_image, packrat_identify_wildlife, etc.).',
      inputSchema: {
        file_name: z.string().min(1),
        content_type: z.string().min(1),
        size: z
          .number()
          .int()
          .min(1)
          .max(10 * 1024 * 1024),
      },
      annotations: {
        title: 'Create Image Upload URL',
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: false,
        openWorldHint: false,
      },
    },
    async ({ file_name, content_type, size }) =>
      call({
        promise: agent.api.user.upload.presigned.get({
          query: { fileName: file_name, contentType: content_type, size },
        }),
        action: 'create presigned upload URL',
      }),
  );
}
