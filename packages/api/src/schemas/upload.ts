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
    filename: z.string().optional().openapi({
      param: { name: 'filename' },
      example: '123-profile-image.jpg',
      description: 'Name of the file to upload (should include user ID prefix)',
    }),
    contentType: z.string().optional().openapi({
      example: 'image/jpeg',
      description: 'MIME type of the file',
    }),
    type: z.string().optional().openapi({
      example: 'pack',
      description: 'Type of upload (e.g., pack, profile)',
    }),
    packId: z.string().optional().openapi({
      example: '123',
      description: 'Pack ID for pack-related uploads',
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
    key: z.string().optional().openapi({
      example: '123-profile-image.jpg',
      description: 'Key/filename in the storage bucket',
    }),
  })
  .openapi('PresignedUploadResponse');
