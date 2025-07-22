import { PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { createRoute, OpenAPIHono, z } from '@hono/zod-openapi';
import type { Env } from '@packrat/api/types/env';
import { authenticateRequest, unauthorizedResponse } from '@packrat/api/utils/api-middleware';
import { env } from 'hono/adapter';
import type { Variables } from '../types/variables';

const uploadRoutes = new OpenAPIHono<{ Bindings: Env; Variables: Variables }>();

// Generate a presigned URL for uploading to R2
const presignedRoute = createRoute({
  method: 'get',
  path: '/presigned',
  request: {
    query: z.object({
      fileName: z.string().optional(),
      contentType: z.string().optional(),
    }),
  },
  responses: { 200: { description: 'Generate presigned upload URL' } },
});

uploadRoutes.openapi(presignedRoute, async (c) => {
  // Authenticate the request
  const auth = await authenticateRequest(c);
  if (!auth) {
    return unauthorizedResponse();
  }

  const {
    R2_ACCESS_KEY_ID,
    R2_SECRET_ACCESS_KEY,
    CLOUDFLARE_ACCOUNT_ID,
    PACKRAT_BUCKET_R2_BUCKET_NAME,
  } = env<Env>(c);

  try {
    const { fileName, contentType } = c.req.query();

    if (!fileName || !contentType) {
      return c.json({ error: 'fileName and contentType are required' }, 400);
    }

    // Initialize S3 client for R2
    const s3Client = new S3Client({
      region: 'auto',
      endpoint: `https://${CLOUDFLARE_ACCOUNT_ID}.r2.cloudflarestorage.com`,
      credentials: {
        accessKeyId: R2_ACCESS_KEY_ID || '',
        secretAccessKey: R2_SECRET_ACCESS_KEY || '',
      },
    }); // Using S3Client because R2 binding doesn't seem to support presigned URLs directly

    // Security check: Ensure the filename starts with the user's ID
    // This prevents users from overwriting other users' images
    if (!fileName.startsWith(`${auth.userId}-`)) {
      return c.json({ error: 'Unauthorized' }, 403);
    }

    // Create the command for putting an object in the bucket
    const command = new PutObjectCommand({
      Bucket: PACKRAT_BUCKET_R2_BUCKET_NAME,
      Key: fileName,
      ContentType: contentType,
    });

    // Generate the presigned URL
    const presignedUrl = await getSignedUrl(s3Client, command, {
      expiresIn: 3600,
    });

    return c.json({
      url: presignedUrl,
    });
  } catch (error) {
    c.get('sentry').setContext('upload-params', {
      fileName: c.req.query('fileName'),
      contentType: c.req.query('contentType'),
      bucketName: PACKRAT_BUCKET_R2_BUCKET_NAME,
      accountId: CLOUDFLARE_ACCOUNT_ID,
      r2AccessKeyId: !!R2_ACCESS_KEY_ID,
      r2SecretAccessKey: !!R2_SECRET_ACCESS_KEY,
    });
    throw error;
  }
});

export { uploadRoutes };
