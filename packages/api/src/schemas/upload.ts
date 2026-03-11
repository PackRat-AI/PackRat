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
    size: z.string().optional().openapi({
      example: '1024000',
      description:
        'Size of the file in bytes (optional; used for client-side validation before upload)',
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

export const RehostRequestSchema = z
  .object({
    url: z.string().url().openapi({
      example: 'https://example.com/image.jpg',
      description: 'External HTTPS image URL to fetch and rehost in R2',
    }),
  })
  .openapi('RehostRequest');

export const RehostResponseSchema = z
  .object({
    key: z.string().openapi({
      example: '1-a1b2c3d4-e5f6-7890-abcd-ef1234567890.jpg',
      description: 'R2 object key for the rehosted image',
    }),
    contentType: z.string().openapi({
      example: 'image/jpeg',
      description: 'MIME type derived from the upstream response (or buffer sniffing)',
    }),
  })
  .openapi('RehostResponse');
