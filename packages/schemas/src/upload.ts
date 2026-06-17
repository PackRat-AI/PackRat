import { z } from 'zod';

export const PresignedUploadQuerySchema = z.object({
  fileName: z.string().optional(),
  contentType: z.string().optional(),
  size: z.string().optional(),
});

export const PresignedUploadResponseSchema = z.object({
  url: z.string().url(),
  objectKey: z.string(),
  publicUrl: z.string().url(),
});
