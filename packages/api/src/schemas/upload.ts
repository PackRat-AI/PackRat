import { z } from 'zod';

export const ErrorResponseSchema = z.object({
  error: z.string(),
  code: z.string().optional(),
});

export const PresignedUploadQuerySchema = z.object({
  fileName: z.string().optional(),
  contentType: z.string().optional(),
  size: z.string().optional(),
});

export const PresignedUploadResponseSchema = z.object({
  url: z.string().url(),
});
