import { z } from 'zod';

// Eden Treaty returns ISO strings (date coercion disabled due to a known bug).
// Drizzle ORM returns Date objects. Both are valid at the boundary — consumers
// should normalise as needed (e.g. new Date(value) or value.toISOString()).
export const dateField = z.union([z.string(), z.date()]);
