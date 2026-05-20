import { z } from 'zod';

export const ErrorResponseSchema = z.object({
  error: z.string(),
  code: z.string().optional(),
});

export const SuccessResponseSchema = z.object({
  success: z.boolean(),
});

export type ErrorResponse = z.infer<typeof ErrorResponseSchema>;
export type SuccessResponse = z.infer<typeof SuccessResponseSchema>;
