import { z } from 'zod';

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

export const UserProfileSchema = z.object({
  success: z.boolean(),
  user: UserSchema,
});
