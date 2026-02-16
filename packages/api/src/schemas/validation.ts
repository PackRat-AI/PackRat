/**
 * PackRat API - Request Validation Schemas
 * 
 * Comprehensive Zod schemas for request validation across all routes.
 * Ensures type safety and proper input validation.
 */

import { z } from 'zod';

// ============================================
// Common Reusable Schemas
// ============================================

/**
 * Pagination query parameters
 */
export const paginationQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
});

export type PaginationQuery = z.infer<typeof paginationQuerySchema>;

/**
 * UUID validation
 */
export const uuidSchema = z.string().uuid('Invalid UUID format');

export type UUID = z.infer<typeof uuidSchema>;

// ============================================
// Trip-related Schemas
// ============================================

/**
 * Trip creation request
 */
export const tripCreateSchema = z.object({
  name: z.string().min(1, 'Trip name is required').max(200),
  destination: z.string().min(1, 'Destination is required').max(500),
  startDate: z.string().datetime({ offset: true }),
  endDate: z.string().datetime({ offset: true }),
  participants: z.array(z.string()).optional(),
  description: z.string().max(2000).optional(),
  visibility: z.enum(['private', 'shared', 'public']).default('private'),
});

export type TripCreate = z.infer<typeof tripCreateSchema>;

/**
 * Trip update request
 */
export const tripUpdateSchema = tripCreateSchema.partial().extend({
  id: uuidSchema,
});

export type TripUpdate = z.infer<typeof tripUpdateSchema>;

/**
 * Trip query parameters
 */
export const tripQuerySchema = paginationQuerySchema.extend({
  status: z.enum(['draft', 'planned', 'active', 'completed', 'cancelled']).optional(),
  sortBy: z.enum(['createdAt', 'startDate', 'name']).default('createdAt'),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
});

export type TripQuery = z.infer<typeof tripQuerySchema>;

// ============================================
// Pack-related Schemas
// ============================================

/**
 * Pack item creation
 */
export const packItemCreateSchema = z.object({
  name: z.string().min(1, 'Item name is required').max(200),
  category: z.string().min(1, 'Category is required'),
  quantity: z.number().int().positive().default(1),
  weight: z.number().nonnegative(),
  unit: z.enum(['oz', 'lb', 'g', 'kg']).default('oz'),
  price: z.number().nonnegative().optional(),
  description: z.string().max(1000).optional(),
  tags: z.array(z.string()).optional(),
});

export type PackItemCreate = z.infer<typeof packItemCreateSchema>;

/**
 * Pack creation
 */
export const packCreateSchema = z.object({
  name: z.string().min(1, 'Pack name is required').max(200),
  tripId: uuidSchema.optional(),
  items: z.array(packItemCreateSchema).optional(),
  description: z.string().max(1000).optional(),
});

export type PackCreate = z.infer<typeof packCreateSchema>;

// ============================================
// Gear Recommendation Schemas
// ============================================

/**
 * Gear preferences
 */
export const gearPreferencesSchema = z.object({
  activities: z.array(z.string()).optional(),
  budget: z
    .object({
      min: z.number().nonnegative().optional(),
      max: z.number().nonnegative().optional(),
    })
    .optional(),
  weightPreference: z.enum(['lightweight', 'standard', 'ultralight']).optional(),
  experience: z.enum(['beginner', 'intermediate', 'expert']).optional(),
});

export type GearPreferences = z.infer<typeof gearPreferencesSchema>;

/**
 * Trip context for recommendations
 */
export const tripContextSchema = z.object({
  destination: z.string().min(1, 'Destination is required'),
  duration: z.number().int().positive().max(30),
  difficulty: z.enum(['easy', 'moderate', 'hard', 'expert']),
  season: z.enum(['spring', 'summer', 'fall', 'winter', 'any']),
  activities: z.array(z.string()).optional(),
});

export type TripContext = z.infer<typeof tripContextSchema>;

/**
 * Gear recommendation request
 */
export const gearRecommendationRequestSchema = z.object({
  preferences: gearPreferencesSchema.optional(),
  tripContext: tripContextSchema,
  limit: z.number().int().positive().max(20).optional(),
});

export type GearRecommendationRequest = z.infer<typeof gearRecommendationRequestSchema>;

// ============================================
// Weather-related Schemas
// ============================================

/**
 * Location search query
 */
export const locationSearchQuerySchema = z.object({
  q: z.string().min(1, 'Search query is required').max(200),
});

export type LocationSearchQuery = z.infer<typeof locationSearchQuerySchema>;

/**
 * Coordinates query
 */
export const coordinatesQuerySchema = z.object({
  lat: z.coerce.number().min(-90).max(90),
  lon: z.coerce.number().min(-180).max(180),
});

export type CoordinatesQuery = z.infer<typeof coordinatesQuerySchema>;

/**
 * Trip weather outlook request
 */
export const tripWeatherOutlookSchema = z.object({
  location: z.string().min(1, 'Location is required'),
  duration: z.number().int().positive().max(14),
});

export type TripWeatherOutlook = z.infer<typeof tripWeatherOutlookSchema>;

// ============================================
// Batch Operations Schemas
// ============================================

/**
 * Batch recommendation request
 */
export const batchRecommendationRequestSchema = z.object({
  requests: z.array(tripContextSchema).min(1).max(10),
  types: z.array(z.enum(['trip', 'gear'])).min(1),
});

export type BatchRecommendationRequest = z.infer<typeof batchRecommendationRequestSchema>;

// ============================================
// Sync-related Schemas
// ============================================

/**
 * Conflict resolution request
 */
export const conflictResolutionSchema = z.object({
  operationId: z.string().min(1),
  resolution: z.enum(['local', 'server', 'merged']),
  mergedData: z.unknown().optional(),
});

export type ConflictResolutionRequest = z.infer<typeof conflictResolutionSchema>;

// ============================================
// Cache-related Schemas
// ============================================

/**
 * Cache invalidation request
 */
export const cacheInvalidationSchema = z.object({
  pattern: z.string().optional(),
});

export type CacheInvalidationRequest = z.infer<typeof cacheInvalidationSchema>;

// ============================================
// User-related Schemas
// ============================================

/**
 * User profile update
 */
export const userProfileUpdateSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  email: z.string().email().optional(),
  avatar: z.string().url().optional(),
  bio: z.string().max(500).optional(),
});

export type UserProfileUpdate = z.infer<typeof userProfileUpdateSchema>;

// ============================================
// Auth-related Schemas
// ============================================

/**
 * Login request
 */
export const loginSchema = z.object({
  email: z.string().email('Invalid email format'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
});

export type LoginRequest = z.infer<typeof loginSchema>;

/**
 * Registration request
 */
export const registerSchema = z.object({
  name: z.string().min(1).max(100),
  email: z.string().email('Invalid email format'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  confirmPassword: z.string(),
}).refine((data) => data.password === data.confirmPassword, {
  message: 'Passwords do not match',
  path: ['confirmPassword'],
});

export type RegisterRequest = z.infer<typeof registerSchema>;

// ============================================
// Validation Helper Functions
// ============================================

/**
 * Validate request body against schema
 * Returns formatted error response if validation fails
 */
export function validateBody<T>(
  body: unknown,
  schema: z.ZodSchema<T>,
): { success: true; data: T } | { success: false; error: { error: string; details: z.ZodError } } {
  const result = schema.safeParse(body);

  if (result.success) {
    return { success: true, data: result.data };
  }

  return {
    success: false,
    error: {
      error: 'Validation error',
      details: result.error,
    },
  };
}

/**
 * Validate query parameters against schema
 */
export function validateQuery<T>(
  query: Record<string, unknown>,
  schema: z.ZodSchema<T>,
): { success: true; data: T } | { success: false; error: { error: string; details: z.ZodError } } {
  const result = schema.safeParse(query);

  if (result.success) {
    return { success: true, data: result.data };
  }

  return {
    success: false,
    error: {
      error: 'Validation error',
      details: result.error,
    },
  };
}
