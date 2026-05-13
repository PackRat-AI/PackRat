import { z } from 'zod';

// --- Pack Category ---
export const PACK_CATEGORIES = Object.freeze([
  'hiking',
  'backpacking',
  'camping',
  'climbing',
  'winter',
  'desert',
  'custom',
  'water sports',
  'skiing',
] as const);

export const PackCategorySchema = z.enum(PACK_CATEGORIES);
export type PackCategory = z.infer<typeof PackCategorySchema>;

// --- Item Category ---
export const ITEM_CATEGORIES = Object.freeze([
  'clothing',
  'shelter',
  'sleep',
  'kitchen',
  'water',
  'electronics',
  'first-aid',
  'navigation',
  'tools',
  'consumables',
  'miscellaneous',
] as const);

export const ItemCategorySchema = z.enum(ITEM_CATEGORIES);
export type ItemCategory = z.infer<typeof ItemCategorySchema>;

// --- Weight Unit ---
export const WEIGHT_UNITS = Object.freeze(['g', 'oz', 'kg', 'lb'] as const);
export const WeightUnitSchema = z.enum(WEIGHT_UNITS);
export type WeightUnit = z.infer<typeof WeightUnitSchema>;

// --- Availability ---
export const AVAILABILITY_VALUES = Object.freeze(['in_stock', 'out_of_stock', 'preorder'] as const);
export const AvailabilitySchema = z.enum(AVAILABILITY_VALUES);
export type Availability = z.infer<typeof AvailabilitySchema>;

// --- Shared item types used by utility functions ---
export type ItemLink = {
  id: string;
  title: string;
  url: string;
  type: 'official' | 'review' | 'guide' | 'purchase' | 'other';
};

export type ItemReview = {
  id: string;
  userId: string;
  userName: string;
  userAvatar?: string;
  rating: number;
  text: string;
  date: string;
  helpful?: number;
  verified?: boolean;
};

// --- Lightweight pack/catalog types for utility functions ---
// These are simpler than the full API schemas and are used by
// calculation utilities (weight.ts, itemCalculations.ts).
export const CatalogItemSchema = z.object({
  id: z.number().int().positive(),
  name: z.string(),
  productUrl: z.string(),
  sku: z.string(),
  weight: z.number().nonnegative(),
  weightUnit: z.string(),
  description: z.string().optional(),
  categories: z.array(z.string()).optional(),
  images: z.array(z.string()).optional(),
  brand: z.string().optional(),
  model: z.string().optional(),
  ratingValue: z.number().optional(),
  color: z.string().optional(),
  size: z.string().optional(),
  price: z.number().optional(),
  availability: z.enum(['in_stock', 'out_of_stock', 'preorder']).optional(),
  seller: z.string().optional(),
  productSku: z.string().optional(),
  material: z.string().optional(),
  currency: z.string().optional(),
  condition: z.string().optional(),
  reviewCount: z.number().int().optional(),
  variants: z
    .array(
      z.object({
        attribute: z.string(),
        values: z.array(z.string()),
      }),
    )
    .optional(),
  techs: z.record(z.string(), z.string()).optional(),
  links: z
    .array(
      z.object({
        title: z.string(),
        url: z.string(),
      }),
    )
    .optional(),
  reviews: z
    .array(
      z.object({
        user_name: z.string(),
        user_avatar: z.string().optional(),
        context: z.record(z.string(), z.string()).optional(),
        recommends: z.boolean().optional(),
        rating: z.number(),
        title: z.string(),
        text: z.string(),
        date: z.string(),
        images: z.array(z.string()).optional(),
        upvotes: z.number().optional(),
        downvotes: z.number().optional(),
        verified: z.boolean().optional(),
      }),
    )
    .optional(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export type CatalogItem = z.infer<typeof CatalogItemSchema>;

export const PackItemSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string().optional(),
  weight: z.number().nonnegative(),
  weightUnit: WeightUnitSchema,
  quantity: z.number().int().positive(),
  category: z.string(),
  consumable: z.boolean(),
  worn: z.boolean(),
  image: z.string().url().optional(),
  notes: z.string().optional(),
  packId: z.string(),
  catalogItemId: z.number().int().positive().optional(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
  userId: z.number().int().positive(),
});

export type PackItem = z.infer<typeof PackItemSchema>;

export const PackSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string().optional(),
  category: PackCategorySchema,
  baseWeight: z.number().nonnegative().optional(),
  totalWeight: z.number().nonnegative().optional(),
  items: z.array(PackItemSchema).optional(),
  userId: z.number().int().positive(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
  isPublic: z.boolean(),
  image: z.string().url().optional(),
  tags: z.array(z.string()).optional(),
});

export type Pack = z.infer<typeof PackSchema>;

export const UserSchema = z.object({
  id: z.number().int().positive(),
  name: z.string(),
  email: z.string().email(),
  avatar: z.string().url(),
  experience: z.enum(['beginner', 'intermediate', 'expert']),
  joinedAt: z.string().datetime(),
  bio: z.string().optional(),
});

export type User = z.infer<typeof UserSchema>;
