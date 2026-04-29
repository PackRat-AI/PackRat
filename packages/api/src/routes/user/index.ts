import { createDb } from '@packrat/api/db';
import { users } from '@packrat/api/db/schema';
import { authPlugin } from '@packrat/api/middleware/auth';
import { UpdateUserRequestSchema } from '@packrat/api/schemas/users';
import { eq } from 'drizzle-orm';
import { Elysia, status } from 'elysia';

export const userRoutes = new Elysia({ prefix: '/user' })
  .use(authPlugin)

  // Get profile
  .get(
    '/profile',
    async ({ user }) => {
      try {
        const db = createDb();
        const [userRecord] = await db
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

        return {
          success: true,
          user: {
            ...userRecord,
            createdAt: userRecord.createdAt?.toISOString() || null,
            updatedAt: userRecord.updatedAt?.toISOString() || null,
          },
        };
      } catch (error) {
        console.error('Error fetching user profile:', error);
        return status(500, { error: 'Failed to fetch user profile', code: 'FETCH_ERROR' });
      }
    },
    {
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
            .select({ id: users.id })
            .from(users)
            .where(eq(users.email, email.toLowerCase()))
            .limit(1);

          if (existingUser && existingUser.id !== user.userId) {
            return status(409, {
              error: 'Email already in use by another user',
              code: 'EMAIL_CONFLICT',
            });
          }
        }

        const updateData: Partial<typeof users.$inferInsert> = {
          updatedAt: new Date(),
        };
        if (firstName !== undefined) updateData.firstName = firstName;
        if (lastName !== undefined) updateData.lastName = lastName;
        if (avatarUrl !== undefined) updateData.avatarUrl = avatarUrl;
        if (email !== undefined) {
          updateData.email = email.toLowerCase();
          updateData.emailVerified = false;
        }

        const [updatedUser] = await db
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

        return {
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
        };
      } catch (error) {
        console.error('Error updating user profile:', error);
        return status(500, { error: 'Failed to update user profile', code: 'UPDATE_ERROR' });
      }
    },
    {
      body: UpdateUserRequestSchema,
      isAuthenticated: true,
      detail: { tags: ['Users'], summary: 'Update user profile', security: [{ bearerAuth: [] }] },
    },
  );
