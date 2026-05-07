import type { TripLocationSchema, TripSchema } from '@packrat/api/schemas/trips';
import type { z } from 'zod';

export type TripLocation = z.infer<typeof TripLocationSchema>;
export type Trip = z.infer<typeof TripSchema>;
