import type { CatalogItemSchema, CatalogItemsResponseSchema } from '@packrat/api/schemas/catalog';
import type { z } from 'zod';

export type CatalogItem = z.infer<typeof CatalogItemSchema>;
export type CatalogItemsResponse = z.infer<typeof CatalogItemsResponseSchema>;
