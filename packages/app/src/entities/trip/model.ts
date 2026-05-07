import type { z } from 'zod';
import type { TripLocationSchema, TripSchema } from './schema';

export type TripLocation = z.infer<typeof TripLocationSchema>;
export type Trip = z.infer<typeof TripSchema>;
