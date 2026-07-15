/**
 * Real unit tests for the upload tool handler
 * (`packages/mcp/src/tools/upload.ts`).
 *
 * `packrat_upload_image_url` GETs a presigned R2 URL, stringifying the
 * numeric `size` into the query. The test asserts the text envelope AND
 * that the presigned endpoint was hit with the camelCased query shape.
 */

import { describe, expect, it } from 'vitest';
import { registerUploadTools } from '../tools/upload';
import type { ApiCall } from './_tool-harness';
import { firstText, getToolHandler, makeAgent, makeExtra } from './_tool-harness';

/** True when a recorded call's path ends with the given trailing segments. */
function endsWith(call: ApiCall, segments: string[]): boolean {
  const tail = call.path.slice(-segments.length);
  return tail.length === segments.length && tail.every((seg, i) => seg === segments[i]);
}

describe('packrat_upload_image_url', () => {
  it('GETs user.upload.presigned with the stringified size query', async () => {
    const { agent, server, calls } = makeAgent();
    registerUploadTools(agent);

    const result = await getToolHandler(server, 'packrat_upload_image_url')(
      { file_name: 'pack.jpg', content_type: 'image/jpeg', size: 2048 },
      makeExtra(),
    );

    expect(result.content[0]?.type).toBe('text');
    expect(firstText(result).length).toBeGreaterThan(0);

    const gets = calls.filter((c) => endsWith(c, ['upload', 'presigned', 'get']));
    expect(gets).toHaveLength(1);
    expect(gets[0]?.args[0]).toEqual({
      query: { fileName: 'pack.jpg', contentType: 'image/jpeg', size: '2048' },
    });
  });
});
