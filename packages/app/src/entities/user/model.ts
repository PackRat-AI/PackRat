import type { UserProfileSchema, UserSchema } from '@packrat/api/schemas/users';
import type { z } from 'zod';

export type User = z.infer<typeof UserSchema>;
export type UserProfile = z.infer<typeof UserProfileSchema>;
