import { PutObjectCommand } from '@aws-sdk/client-s3';
import { createRoute, OpenAPIHono } from '@hono/zod-openapi';
import { z } from 'zod';
import {
  ErrorResponseSchema,
  PresignedUploadQuerySchema,
  PresignedUploadResponseSchema,
} from '@packrat/api/schemas/upload';
import type { Env } from '@packrat/api/types/env';
import { getEnv } from '@packrat/api/utils/env-validation';
import type { Variables } from '../types/variables';
import { getPresignedUrl } from '../utils/getPresignedUrl';

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
    const { filename, contentType, type, packId } = c.req.query();

    if (!filename || !contentType) {
      return c.json({ error: 'filename and contentType are required' }, 400);
    }

    // Validate content type - only allow images and common file types
    const allowedContentTypes = [
      'image/jpeg',
      'image/jpg',
      'image/png',
      'image/gif',
      'image/webp',
      'image/svg+xml',
      'application/pdf',
    ];

    if (!allowedContentTypes.includes(contentType)) {
      return c.json({ error: 'Invalid content type. Only images are allowed.' }, 400);
    }

    // Validate pack uploads require packId
    if (type === 'pack' && !packId) {
      return c.json({ error: 'packId is required for pack image uploads' }, 400);
    }

    // Sanitize filename to prevent directory traversal attacks
    const sanitizedFilename = filename.replace(/\.\./g, '').replace(/\//g, '-');

    // Automatically prepend user ID to filename for security
    // This prevents users from overwriting other users' images
    const secureFileName = sanitizedFilename.startsWith(`${auth.userId}-`)
      ? sanitizedFilename
      : `${auth.userId}-${sanitizedFilename}`;

    // Create the command for putting an object in the bucket
    const command = new PutObjectCommand({
      Bucket: PACKRAT_BUCKET_R2_BUCKET_NAME,
      Key: secureFileName,
      ContentType: contentType,
    });

    // Generate the presigned URL
    const presignedUrl = await getPresignedUrl(c, command, {
      expiresIn: 3600,
    });

    return c.json(
      {
        url: presignedUrl,
        key: secureFileName,
      },
      200,
    );
  } catch (error) {
    c.get('sentry').setContext('upload-params', {
      filename: c.req.query('filename'),
      contentType: c.req.query('contentType'),
      bucketName: PACKRAT_BUCKET_R2_BUCKET_NAME,
      accountId: CLOUDFLARE_ACCOUNT_ID,
      r2AccessKeyId: !!R2_ACCESS_KEY_ID,
      r2SecretAccessKey: !!R2_SECRET_ACCESS_KEY,
    });
    throw error;
  }
});

// Get file information endpoint
const getFileRoute = createRoute({
  method: 'get',
  path: '/:key',
  tags: ['Upload'],
  summary: 'Get file information',
  description: 'Retrieve information about an uploaded file',
  security: [{ bearerAuth: [] }],
  request: {
    params: z.object({
      key: z.string().openapi({
        description: 'File key in storage',
        example: 'test-key-123',
      }),
    }),
  },
  responses: {
    200: {
      description: 'File information retrieved successfully',
      content: {
        'application/json': {
          schema: z.object({
            key: z.string(),
            url: z.string(),
          }),
        },
      },
    },
    404: {
      description: 'File not found',
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

uploadRoutes.openapi(getFileRoute, async (c) => {
  const { CLOUDFLARE_ACCOUNT_ID, PACKRAT_BUCKET_R2_BUCKET_NAME } = getEnv(c);

  try {
    const key = c.req.param('key');

    // Construct the R2 public URL for the file
    const url = `https://${PACKRAT_BUCKET_R2_BUCKET_NAME}.${CLOUDFLARE_ACCOUNT_ID}.r2.cloudflarestorage.com/${key}`;

    return c.json(
      {
        key,
        url,
      },
      200,
    );
  } catch (error) {
    c.get('sentry').setContext('upload-params', {
      key: c.req.param('key'),
    });
    throw error;
  }
});

export { uploadRoutes };
