import { PutObjectCommand } from '@aws-sdk/client-s3';
import { authPlugin } from '@packrat/api/middleware/auth';
import { PresignedUploadQuerySchema } from '@packrat/api/schemas/upload';
import { getEnv } from '@packrat/api/utils/env-validation';
import { getPresignedUrl } from '@packrat/api/utils/getPresignedUrl';
import { Elysia, status } from 'elysia';

const ALLOWED_IMAGE_TYPES = [
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/gif',
  'image/webp',
  'image/svg+xml',
];

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB in bytes

export const uploadRoutes = new Elysia({ prefix: '/upload' })
  .use(authPlugin)
  .get(
    '/presigned',
    async ({ query, user }) => {
      const { PACKRAT_BUCKET_R2_BUCKET_NAME } = getEnv();

      const { fileName, contentType, size } = query;

      if (!fileName || !contentType) {
        return status(400, { error: 'fileName and contentType are required' });
      }

      // Validate content type - only allow images
      if (!ALLOWED_IMAGE_TYPES.includes(contentType.toLowerCase())) {
        return status(400, { error: 'Invalid content type. Only image files are allowed.' });
      }

      // Validate file size - max 10MB
      if (size) {
        const fileSize = Number.parseInt(String(size), 10);
        if (Number.isNaN(fileSize) || fileSize <= 0 || fileSize > MAX_FILE_SIZE) {
          return status(400, { error: 'File size must be greater than 0 and not exceed 10MB' });
        }
      }

      // Security check: Ensure the filename starts with the user's ID
      if (!fileName.startsWith(`${user.userId}-`)) {
        return status(403, { error: 'Unauthorized' });
      }

      const command = new PutObjectCommand({
        Bucket: PACKRAT_BUCKET_R2_BUCKET_NAME,
        Key: fileName,
        ContentType: contentType,
      });

      const presignedUrl = await getPresignedUrl({
        command,
        signOptions: { expiresIn: 3600 },
      });

      return { url: presignedUrl };
    },
    {
      query: PresignedUploadQuerySchema,
      isAuthenticated: true,
      detail: {
        tags: ['Upload'],
        summary: 'Generate presigned upload URL',
        description: 'Generate a presigned URL for secure file uploads to R2 storage',
        security: [{ bearerAuth: [] }],
      },
    },
  );
