import { z } from 'zod';
import { dateField } from '../../shared/lib/date';

export const UserSchema = z.object({
  id: z.number().int().positive(),
  email: z.string().email(),
  firstName: z.string().nullable(),
  lastName: z.string().nullable(),
  role: z.string().nullable().default('USER'),
  emailVerified: z.boolean().nullable(),
  createdAt: dateField.nullable(),
  updatedAt: dateField.nullable(),
  avatarUrl: z.string().nullable().optional(),
});

export const UserProfileSchema = z.object({
  success: z.boolean(),
  user: UserSchema,
});
