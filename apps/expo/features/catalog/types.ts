import type { CatalogItemSchema } from '@packrat/api/schemas/catalog';
import type { z } from 'zod';
import type { PackItemInput } from '../packs/input';

export type CatalogItem = z.infer<typeof CatalogItemSchema>;

export type CatalogItemWithQuantity = CatalogItem & { quantity?: number };

export interface PaginatedCatalogItemsResponse {
  items: CatalogItem[];
  totalCount: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface CatalogItemInput {
  name: string;
  description?: string;
  defaultWeight?: number;
  defaultWeightUnit?: string;
  category?: string;
  image?: string;
  brand?: string;
  model?: string;
  url?: string;

  // New fields
  ratingValue?: number;
  productUrl?: string;
  color?: string | null;
  size?: string | null;
  sku?: string;
  price?: number | null;
  availability?: string;
  seller?: string;
  productSku?: string;
  material?: string;
  currency?: string;
  condition?: string;
  techs?: Record<string, string>;
  links?: Array<{ title: string; url: string }>;
  reviews?: Array<{
    user_name: string;
    rating: number;
    title: string;
    text: string;
    date: string;
  }>;
}

export type CatalogItemWithPackItemFields = CatalogItem & Partial<PackItemInput>;
