import { z } from '@hono/zod-openapi';

export const ErrorResponseSchema = z
  .object({
    error: z.string().openapi({
      description: 'Error message',
    }),
    code: z.string().optional().openapi({
      description: 'Error code for programmatic handling',
    }),
  })
  .openapi('ErrorResponse');

export const PresignedUploadQuerySchema = z
  .object({
    fileName: z.string().optional().openapi({
      example: '123-profile-image.jpg',
      description: 'Name of the file to upload (should include user ID prefix)',
    }),
    contentType: z.string().optional().openapi({
      example: 'image/jpeg',
      description: 'MIME type of the file',
    }),
  })
  .openapi('PresignedUploadQuery');

export const PresignedUploadResponseSchema = z
  .object({
    url: z.string().url().openapi({
      example:
        'https://packrat-bucket.s3.amazonaws.com/uploads/123-profile-image.jpg?AWSAccessKeyId=...',
      description: 'Pre-signed URL for uploading the file',
    }),
  })
  .openapi('PresignedUploadResponse');
