import { z } from 'zod';

// Base user schema
export const UserSchema = z.object({
  id: z.number().int().positive(),
  email: z.string().email(),
  firstName: z.string().nullable(),
  lastName: z.string().nullable(),
  role: z.string().nullable().default('USER'),
  emailVerified: z.boolean().nullable(),
  createdAt: z.string().nullable(),
  updatedAt: z.string().nullable(),
  avatarUrl: z.string().nullable().optional(),
});

// User profile response schema
export const UserProfileSchema = z.object({
  success: z.boolean(),
  user: UserSchema,
});

// Update user request schema
export const UpdateUserRequestSchema = z.object({
  firstName: z.string().optional(),
  lastName: z.string().optional(),
  email: z.string().email().optional(),
  avatarUrl: z.string().nullable().optional(),
});

// Update user response schema
export const UpdateUserResponseSchema = z.object({
  success: z.boolean(),
  message: z.string(),
  user: UserSchema,
});

// User search query schema
export const UserSearchQuerySchema = z.object({
  q: z.string().optional(),
  limit: z.number().int().positive().max(100).default(20),
  offset: z.number().int().min(0).default(0),
});

// User list response schema
export const UserListResponseSchema = z.object({
  success: z.boolean(),
  users: z.array(UserSchema),
  pagination: z.object({
    total: z.number().int().min(0),
    limit: z.number().int().positive(),
    offset: z.number().int().min(0),
    hasMore: z.boolean(),
  }),
});

// User items response schema (for pack items belonging to user)
export const UserItemsResponseSchema = z.array(
  z.object({
    id: z.string(),
    name: z.string(),
    quantity: z.number().int().positive().default(1),
    weight: z.number().positive().nullable(),
    weightUnit: z.string().default('g'),
    category: z.string().nullable(),
    packId: z.string(),
    catalogItem: z
      .object({
        id: z.number(),
        name: z.string(),
        brand: z.string().nullable(),
        categories: z.array(z.string()).nullable(),
        description: z.string().nullable(),
        price: z.number().nullable(),
        weight: z.number().nullable(),
        images: z.array(z.string()).nullable(),
      })
      .nullable(),
    createdAt: z.string(),
    updatedAt: z.string(),
  }),
);

// Admin user stats schema
export const AdminUserStatsSchema = z.object({
  totalUsers: z.number().int().min(0),
  verifiedUsers: z.number().int().min(0),
  unverifiedUsers: z.number().int().min(0),
  adminUsers: z.number().int().min(0),
  recentSignups: z.number().int().min(0),
});
