import { PutObjectCommand } from '@aws-sdk/client-s3';
import { createRoute, OpenAPIHono } from '@hono/zod-openapi';
import {
  ErrorResponseSchema,
  PresignedUploadQuerySchema,
  PresignedUploadResponseSchema,
} from '@packrat/api/schemas/upload';
import type { Env } from '@packrat/api/types/env';
import { getEnv } from '@packrat/api/utils/env-validation';
import type { Variables } from '../types/variables';
import { getPresignedUrl } from '../utils/getPresignedUrl';

const ALLOWED_IMAGE_TYPES = [
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/gif',
  'image/webp',
  'image/svg+xml',
];

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB in bytes

const uploadRoutes = new OpenAPIHono<{ Bindings: Env; Variables: Variables }>();

// Generate a presigned URL for uploading to R2
const presignedRoute = createRoute({
  method: 'get',
  path: '/presigned',
  tags: ['Upload'],
  summary: 'Generate presigned upload URL',
  description: 'Generate a presigned URL for secure file uploads to R2 storage',
  security: [{ bearerAuth: [] }],
  request: {
    query: PresignedUploadQuerySchema,
  },
  responses: {
    200: {
      description: 'Presigned URL generated successfully',
      content: {
        'application/json': {
          schema: PresignedUploadResponseSchema,
        },
      },
    },
    400: {
      description: 'Bad request - fileName and contentType are required',
      content: {
        'application/json': {
          schema: ErrorResponseSchema,
        },
      },
    },
    403: {
      description: 'Forbidden - File name must start with user ID',
      content: {
        'application/json': {
          schema: ErrorResponseSchema,
        },
      },
    },
    500: {
      description: 'Internal server error',
      content: {
        'application/json': {
          schema: ErrorResponseSchema,
        },
      },
    },
  },
});

uploadRoutes.openapi(presignedRoute, async (c) => {
  const auth = c.get('user');

  const {
    R2_ACCESS_KEY_ID,
    R2_SECRET_ACCESS_KEY,
    CLOUDFLARE_ACCOUNT_ID,
    PACKRAT_BUCKET_R2_BUCKET_NAME,
  } = getEnv(c);

  try {
    const { fileName, contentType, size } = c.req.query();

    if (!fileName || !contentType) {
      return c.json({ error: 'fileName and contentType are required' }, 400);
    }

    // Validate content type - only allow images
    if (!ALLOWED_IMAGE_TYPES.includes(contentType.toLowerCase())) {
      return c.json({ error: 'Invalid content type. Only image files are allowed.' }, 400);
    }

    // Validate file size - max 10MB
    if (size) {
      const fileSize = Number.parseInt(size, 10);
      if (Number.isNaN(fileSize) || fileSize <= 0 || fileSize > MAX_FILE_SIZE) {
        return c.json({ error: 'File size must be greater than 0 and not exceed 10MB' }, 400);
      }
    }

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
    const presignedUrl = await getPresignedUrl(c, command, {
      expiresIn: 3600,
    });

    return c.json(
      {
        url: presignedUrl,
      },
      200,
    );
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
