import type { z } from 'zod';
import type { UserProfileSchema, UserSchema } from './schema';

export type User = z.infer<typeof UserSchema>;
export type UserProfile = z.infer<typeof UserProfileSchema>;
