import type { AgentContext } from '../types';

// DISABLED — the only tool here (packrat_upload_image_url) exists solely to
// mint R2 keys for the image tools (packrat_analyze_pack_image,
// packrat_identify_wildlife), all now disabled. It also hands back a presigned
// URL the caller must PUT to out-of-band — which a Claude.ai user can never do
// (the model can't upload a user's local/attached photo). So it returns an
// unusable URL on the connector. Re-enable together with a viable connector
// image-ingestion path (blocked on the platform — see packs.ts
// analyze_pack_image note and python-sdk #499/#771).
//
// Imports removed with the tool: `z` (zod), `call` (../client),
// `tool` (../registerTool).
export function registerUploadTools(_agent: AgentContext): void {
  // No tools registered while image ingestion is disabled on the connector.
  //
  // tool<{ file_name: string; content_type: string; size: number }>(
  //   _agent.server,
  //   'packrat_upload_image_url',
  //   {
  //     title: 'Create Image Upload URL',
  //     description:
  //       'Generate a presigned R2 URL the caller can PUT an image to (jpeg/png/webp, ≤10MB). Returns { uploadUrl, key } — use `key` in downstream tools (packrat_analyze_pack_image, packrat_identify_wildlife, etc.).',
  //     inputSchema: {
  //       file_name: z.string().min(1),
  //       content_type: z.string().min(1),
  //       size: z
  //         .number()
  //         .int()
  //         .min(1)
  //         .max(10 * 1024 * 1024),
  //     },
  //     annotations: {
  //       title: 'Create Image Upload URL',
  //       readOnlyHint: false,
  //       destructiveHint: false,
  //       idempotentHint: false,
  //       openWorldHint: false,
  //     },
  //   },
  //   async ({ file_name, content_type, size }) =>
  //     call({
  //       promise: _agent.api.user.upload.presigned.get({
  //         query: { fileName: file_name, contentType: content_type, size: String(size) },
  //       }),
  //       action: 'create presigned upload URL',
  //     }),
  // );
}
