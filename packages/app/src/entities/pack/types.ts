import type { z } from 'zod';
import type {
  PackItemSchema,
  PackListResponseSchema,
  PackSchema,
  PackWithWeightsSchema,
} from './schema';

export type Pack = z.infer<typeof PackSchema>;
export type PackItem = z.infer<typeof PackItemSchema>;
export type PackWithWeights = z.infer<typeof PackWithWeightsSchema>;
export type PackListResponse = z.infer<typeof PackListResponseSchema>;
