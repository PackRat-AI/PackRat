import { PutObjectCommand } from '@aws-sdk/client-s3';
import { createRoute, OpenAPIHono } from '@hono/zod-openapi';
import {
  ErrorResponseSchema,
  PresignedUploadQuerySchema,
  PresignedUploadResponseSchema,
  RehostRequestSchema,
  RehostResponseSchema,
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

const CONTENT_TYPE_TO_EXT: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/jpg': 'jpg',
  'image/png': 'png',
  'image/gif': 'gif',
  'image/webp': 'webp',
  'image/svg+xml': 'svg',
};

/**
 * Sniff the content type from the first bytes of the buffer.
 * Returns null if the format cannot be identified.
 */
function sniffContentType(buf: Uint8Array): string | null {
  // JPEG: FF D8 FF
  if (buf.length >= 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) {
    return 'image/jpeg';
  }

  // PNG: 89 50 4E 47 0D 0A 1A 0A
  if (
    buf.length >= 8 &&
    buf[0] === 0x89 &&
    buf[1] === 0x50 &&
    buf[2] === 0x4e &&
    buf[3] === 0x47 &&
    buf[4] === 0x0d &&
    buf[5] === 0x0a &&
    buf[6] === 0x1a &&
    buf[7] === 0x0a
  ) {
    return 'image/png';
  }

  // GIF: 47 49 46 38 (GIF8)
  if (buf.length >= 4 && buf[0] === 0x47 && buf[1] === 0x49 && buf[2] === 0x46 && buf[3] === 0x38) {
    return 'image/gif';
  }

  // WebP: RIFF (52 49 46 46) at byte 0 + WEBP (57 45 42 50) at byte 8
  if (
    buf.length >= 12 &&
    buf[0] === 0x52 &&
    buf[1] === 0x49 &&
    buf[2] === 0x46 &&
    buf[3] === 0x46 &&
    buf[8] === 0x57 &&
    buf[9] === 0x45 &&
    buf[10] === 0x42 &&
    buf[11] === 0x50
  ) {
    return 'image/webp';
  }

  return null;
}

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

// Rehost an image from an external URL into R2
const rehostRoute = createRoute({
  method: 'post',
  path: '/rehost',
  tags: ['Upload'],
  summary: 'Rehost an external image into R2',
  description:
    'Fetches an image from an external HTTPS URL, derives the correct content type from the upstream response headers (falling back to buffer sniffing), and stores it in R2 under a user-scoped key.',
  security: [{ bearerAuth: [] }],
  request: {
    body: {
      content: {
        'application/json': {
          schema: RehostRequestSchema,
        },
      },
      required: true,
    },
  },
  responses: {
    200: {
      description: 'Image rehosted successfully',
      content: {
        'application/json': {
          schema: RehostResponseSchema,
        },
      },
    },
    400: {
      description: 'Bad request – invalid URL or unsupported image type',
      content: {
        'application/json': {
          schema: ErrorResponseSchema,
        },
      },
    },
    401: {
      description: 'Unauthorized',
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

uploadRoutes.openapi(rehostRoute, async (c) => {
  const auth = c.get('user');
  const { url } = c.req.valid('json');

  // Only allow HTTPS URLs to prevent SSRF against plain-text services
  if (!url.startsWith('https://')) {
    return c.json({ error: 'Only HTTPS URLs are supported' }, 400);
  }

  const { PACKRAT_BUCKET } = getEnv(c);

  let buffer: ArrayBuffer;
  let upstreamContentType: string | null = null;

  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; PackRat/1.0)',
        Accept: 'image/*',
      },
    });

    if (!response.ok) {
      return c.json({ error: `Failed to fetch image: HTTP ${response.status}` }, 400);
    }

    // Derive content type from upstream response headers, stripping parameters
    const rawContentType = response.headers.get('content-type');
    if (rawContentType) {
      upstreamContentType = rawContentType.split(';')[0].trim().toLowerCase();
    }

    buffer = await response.arrayBuffer();
  } catch (err) {
    c.get('sentry').captureException(err);
    return c.json({ error: 'Failed to fetch image from the provided URL' }, 400);
  }

  const bytes = new Uint8Array(buffer);

  // Trust the upstream Content-Type when it's already in our allow-list: it's
  // usually accurate and buffer sniffing can't identify every format (e.g. GIF,
  // SVG).  Sniffing is only used as a fallback when the header is absent or
  // carries an unrecognised MIME type (e.g. `application/octet-stream`).
  let contentType = upstreamContentType;
  if (!contentType || !ALLOWED_IMAGE_TYPES.includes(contentType)) {
    contentType = sniffContentType(bytes);
  }

  if (!contentType || !ALLOWED_IMAGE_TYPES.includes(contentType)) {
    return c.json({ error: 'URL does not point to a supported image type' }, 400);
  }

  const ext = CONTENT_TYPE_TO_EXT[contentType] ?? 'bin';
  const key = `${auth.userId}-${crypto.randomUUID()}.${ext}`;

  try {
    await PACKRAT_BUCKET.put(key, buffer, {
      httpMetadata: { contentType },
    });
  } catch (err) {
    c.get('sentry').captureException(err);
    return c.json({ error: 'Failed to store image' }, 500);
  }

  return c.json({ key, contentType }, 200);
});

export { uploadRoutes };
