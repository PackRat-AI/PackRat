import * as d1Schema from '@packrat/db/d1Schema';
import { drizzle } from 'drizzle-orm/d1';

export const createMetricsDb = (binding: D1Database) => drizzle(binding, { schema: d1Schema });

export type MetricsDb = ReturnType<typeof createMetricsDb>;
