import { createDb } from '@packrat/api/db';
import { authPlugin } from '@packrat/api/middleware/auth';
import { captureApiException } from '@packrat/api/utils/sentry';
import { users } from '@packrat/db';
import { ErrorResponseSchema } from '@packrat/schemas/shared';
import {
  GetPreferencesResponseSchema,
  PatchPreferencesResponseSchema,
  UpdateUserRequestSchema,
  UpdateUserResponseSchema,
  UserPreferencesSchema,
  UserProfileSchema,
} from '@packrat/schemas/users';
import { eq } from 'drizzle-orm';
import { Elysia, status } from 'elysia';

export const userRoutes = new Elysia({ prefix: '/user' })
  .model({
    'user.ErrorResponse': ErrorResponseSchema,
    'user.UpdateUserRequest': UpdateUserRequestSchema,
    'user.UpdateUserResponse': UpdateUserResponseSchema,
    'user.UserProfile': UserProfileSchema,
  })
  .use(authPlugin)

  // Get profile
  .get(
    '/profile',
    async ({ user }) => {
      try {
        const db = createDb();
        const [userRecord] = await db
          .tag('user.getProfile')
          .select({
            id: users.id,
            email: users.email,
            firstName: users.firstName,
            lastName: users.lastName,
            avatarUrl: users.avatarUrl,
            role: users.role,
            emailVerified: users.emailVerified,
            createdAt: users.createdAt,
            updatedAt: users.updatedAt,
          })
          .from(users)
          .where(eq(users.id, user.userId))
          .limit(1);

        if (!userRecord) {
          return status(404, { error: 'User not found', code: 'USER_NOT_FOUND' });
        }

        return UserProfileSchema.parse({
          success: true,
          user: {
            ...userRecord,
            createdAt: userRecord.createdAt?.toISOString() || null,
            updatedAt: userRecord.updatedAt?.toISOString() || null,
          },
        });
      } catch (error) {
        captureApiException({
          error: error,
          operation: 'user.getProfile',
          userId: user.userId,
          tags: { feature: 'user' },
        });
        throw error;
      }
    },
    {
      response: { 200: 'user.UserProfile', 404: 'user.ErrorResponse' },
      isAuthenticated: true,
      detail: { tags: ['Users'], summary: 'Get user profile', security: [{ bearerAuth: [] }] },
    },
  )

  // Update profile
  .put(
    '/profile',
    async ({ body, user }) => {
      try {
        const { firstName, lastName, email, avatarUrl } = body;
        const db = createDb();

        if (email) {
          const [existingUser] = await db
            .tag('user.checkEmail')
            .select({ id: users.id })
            .from(users)
            .where(eq(users.email, email.toLowerCase()))
            .limit(1);

          if (existingUser && existingUser.id !== user.userId) {
            return status(409, { error: 'Email already in use by another user' });
          }
        }

        const updateData: Partial<typeof users.$inferInsert> = {
          updatedAt: new Date(),
        };
        if (firstName !== undefined) updateData.firstName = firstName;
        if (lastName !== undefined) updateData.lastName = lastName;
        // Keep Better Auth's combined name field in sync to prevent stale display
        // when the sign-in response derives firstName/lastName from name.
        if (firstName !== undefined || lastName !== undefined) {
          const [existingUser] = await db
            .tag('user.getNameForSync')
            .select({ firstName: users.firstName, lastName: users.lastName })
            .from(users)
            .where(eq(users.id, user.userId))
            .limit(1);
          const newFirst = firstName ?? existingUser?.firstName ?? '';
          const newLast = lastName ?? existingUser?.lastName ?? '';
          updateData.name = `${newFirst} ${newLast}`.trim();
        }
        if (avatarUrl !== undefined) updateData.avatarUrl = avatarUrl;
        if (email !== undefined) {
          updateData.email = email.toLowerCase();
          updateData.emailVerified = false;
        }

        const [updatedUser] = await db
          .tag('user.updateProfile')
          .update(users)
          .set(updateData)
          .where(eq(users.id, user.userId))
          .returning();

        if (!updatedUser) {
          return status(404, { error: 'User not found', code: 'USER_NOT_FOUND' });
        }

        const message = email
          ? 'Profile updated successfully. Please verify your new email address.'
          : 'Profile updated successfully';

        return UpdateUserResponseSchema.parse({
          success: true,
          message,
          user: {
            id: updatedUser.id,
            email: updatedUser.email,
            firstName: updatedUser.firstName,
            lastName: updatedUser.lastName,
            avatarUrl: updatedUser.avatarUrl,
            role: updatedUser.role,
            emailVerified: updatedUser.emailVerified,
            createdAt: updatedUser.createdAt?.toISOString() || null,
            updatedAt: updatedUser.updatedAt?.toISOString() || null,
          },
        });
      } catch (error) {
        captureApiException({
          error: error,
          operation: 'user.updateProfile',
          userId: user.userId,
          tags: { feature: 'user' },
        });
        throw error;
      }
    },
    {
      body: 'user.UpdateUserRequest',
      isAuthenticated: true,
      detail: { tags: ['Users'], summary: 'Update user profile', security: [{ bearerAuth: [] }] },
    },
  )

  // Get preferences
  .get(
    '/preferences',
    async ({ user }) => {
      try {
        const db = createDb();
        const [row] = await db
          .tag('user.getPreferences')
          .select({ preferences: users.preferences })
          .from(users)
          .where(eq(users.id, user.userId))
          .limit(1);

        if (!row) return status(404, { error: 'User not found', code: 'USER_NOT_FOUND' });

        return GetPreferencesResponseSchema.parse({
          preferences: UserPreferencesSchema.parse(row.preferences ?? {}),
        });
      } catch (error) {
        captureApiException({
          error,
          operation: 'user.getPreferences',
          userId: user.userId,
          tags: { feature: 'user' },
        });
        throw error;
      }
    },
    {
      response: { 200: GetPreferencesResponseSchema, 404: ErrorResponseSchema },
      isAuthenticated: true,
      detail: { tags: ['Users'], summary: 'Get user preferences', security: [{ bearerAuth: [] }] },
    },
  )

  // Update preferences (full replace — client always sends complete state)
  .patch(
    '/preferences',
    async ({ body, user }) => {
      try {
        const db = createDb();
        const [row] = await db
          .tag('user.updatePreferences')
          .update(users)
          .set({ preferences: body, updatedAt: new Date() })
          .where(eq(users.id, user.userId))
          .returning();

        if (!row) return status(404, { error: 'User not found', code: 'USER_NOT_FOUND' });

        return PatchPreferencesResponseSchema.parse({
          preferences: UserPreferencesSchema.parse(row.preferences ?? {}),
        });
      } catch (error) {
        captureApiException({
          error,
          operation: 'user.updatePreferences',
          userId: user.userId,
          tags: { feature: 'user' },
        });
        throw error;
      }
    },
    {
      body: UserPreferencesSchema,
      response: { 200: PatchPreferencesResponseSchema, 404: ErrorResponseSchema },
      isAuthenticated: true,
      detail: {
        tags: ['Users'],
        summary: 'Update user preferences',
        security: [{ bearerAuth: [] }],
      },
    },
  );
