import { z } from '@hono/zod-openapi';

// Base user schema
export const UserSchema = z
  .object({
    id: z.number().int().positive().openapi({
      example: 123,
      description: 'Unique user identifier',
    }),
    email: z.string().email().openapi({
      example: 'user@example.com',
      description: 'User email address',
    }),
    firstName: z.string().nullable().openapi({
      example: 'John',
      description: 'User first name',
    }),
    lastName: z.string().nullable().openapi({
      example: 'Doe',
      description: 'User last name',
    }),
    role: z
      .string()
      .nullable()
      .default('USER')
      .openapi({
        example: 'USER',
        description: 'User role (USER, ADMIN)',
        enum: ['USER', 'ADMIN'],
      }),
    emailVerified: z.boolean().nullable().openapi({
      example: true,
      description: 'Whether the user email has been verified',
    }),
    createdAt: z.string().nullable().openapi({
      example: '2024-01-15T10:30:00Z',
      description: 'User account creation timestamp',
    }),
    updatedAt: z.string().nullable().openapi({
      example: '2024-01-15T10:30:00Z',
      description: 'User account last update timestamp',
    }),
  })
  .openapi('User');

// User profile response schema
export const UserProfileSchema = z
  .object({
    success: z.boolean().openapi({ example: true }),
    user: UserSchema,
  })
  .openapi('UserProfile');

// Update user request schema
export const UpdateUserRequestSchema = z
  .object({
    firstName: z.string().optional().openapi({
      example: 'Jane',
      description: 'Updated first name',
    }),
    lastName: z.string().optional().openapi({
      example: 'Smith',
      description: 'Updated last name',
    }),
    email: z.string().email().optional().openapi({
      example: 'newemail@example.com',
      description: 'Updated email address (requires re-verification)',
    }),
  })
  .openapi('UpdateUserRequest');

// Update user response schema
export const UpdateUserResponseSchema = z
  .object({
    success: z.boolean().openapi({ example: true }),
    message: z.string().openapi({
      example: 'User profile updated successfully',
    }),
    user: UserSchema,
  })
  .openapi('UpdateUserResponse');

// User search query schema
export const UserSearchQuerySchema = z
  .object({
    q: z.string().optional().openapi({
      example: 'john',
      description: 'Search query for user email, first name, or last name',
    }),
    limit: z.number().int().positive().max(100).default(20).openapi({
      example: 20,
      description: 'Maximum number of results to return',
    }),
    offset: z.number().int().min(0).default(0).openapi({
      example: 0,
      description: 'Number of results to skip for pagination',
    }),
  })
  .openapi('UserSearchQuery');

// User list response schema
export const UserListResponseSchema = z
  .object({
    success: z.boolean().openapi({ example: true }),
    users: z.array(UserSchema),
    pagination: z.object({
      total: z.number().int().min(0).openapi({
        example: 150,
        description: 'Total number of users matching the search',
      }),
      limit: z.number().int().positive().openapi({
        example: 20,
        description: 'Maximum results per page',
      }),
      offset: z.number().int().min(0).openapi({
        example: 0,
        description: 'Current page offset',
      }),
      hasMore: z.boolean().openapi({
        example: true,
        description: 'Whether there are more results available',
      }),
    }),
  })
  .openapi('UserListResponse');

// User items response schema (for pack items belonging to user)
export const UserItemsResponseSchema = z
  .array(
    z.object({
      id: z.string().openapi({
        example: 'pi_123456',
        description: 'Pack item ID',
      }),
      name: z.string().openapi({
        example: 'Hiking Boots',
        description: 'Item name',
      }),
      quantity: z.number().int().positive().default(1).openapi({
        example: 1,
        description: 'Quantity of this item',
      }),
      weight: z.number().positive().nullable().openapi({
        example: 850,
        description: 'Weight of the item in grams',
      }),
      weightUnit: z.string().default('g').openapi({
        example: 'g',
        description: 'Unit of weight measurement',
      }),
      category: z.string().nullable().openapi({
        example: 'Footwear',
        description: 'Item category',
      }),
      packId: z.string().openapi({
        example: 'p_123456',
        description: 'Pack this item belongs to',
      }),
      catalogItem: z
        .object({
          id: z.number().openapi({ example: 12345 }),
          name: z.string().openapi({ example: 'Merrell Hiking Boots' }),
          brand: z.string().nullable().openapi({ example: 'Merrell' }),
          category: z.string().nullable().openapi({ example: 'Footwear' }),
          description: z.string().nullable(),
          price: z.number().nullable().openapi({ example: 129.99 }),
          weight: z.number().nullable().openapi({ example: 850 }),
          image: z.string().nullable(),
        })
        .nullable()
        .openapi({
          description: 'Catalog item details if this item references a catalog item',
        }),
      createdAt: z.string().openapi({
        example: '2024-01-15T10:30:00Z',
      }),
      updatedAt: z.string().openapi({
        example: '2024-01-15T10:30:00Z',
      }),
    }),
  )
  .openapi('UserItemsResponse');

// Admin user stats schema
export const AdminUserStatsSchema = z
  .object({
    totalUsers: z.number().int().min(0).openapi({
      example: 1250,
      description: 'Total number of registered users',
    }),
    verifiedUsers: z.number().int().min(0).openapi({
      example: 1100,
      description: 'Number of users with verified emails',
    }),
    unverifiedUsers: z.number().int().min(0).openapi({
      example: 150,
      description: 'Number of users with unverified emails',
    }),
    adminUsers: z.number().int().min(0).openapi({
      example: 5,
      description: 'Number of admin users',
    }),
    recentSignups: z.number().int().min(0).openapi({
      example: 23,
      description: 'New user signups in the last 30 days',
    }),
  })
  .openapi('AdminUserStats');
