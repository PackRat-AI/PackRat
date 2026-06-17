import type { z } from 'zod';
import type { CatalogItemSchema, CatalogItemsResponseSchema } from './schema';

export type CatalogItem = z.infer<typeof CatalogItemSchema>;
export type CatalogItemsResponse = z.infer<typeof CatalogItemsResponseSchema>;
