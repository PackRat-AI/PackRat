import { z } from 'zod';

// Accepts Date objects from Drizzle at runtime and coerces to ISO string for the wire.
export const datetimeString = z.preprocess(
  (v) => (v instanceof Date ? v.toISOString() : v),
  z.string().datetime(),
);
