import { createRoute, OpenAPIHono } from '@hono/zod-openapi';
import { createDb } from '@packrat/api/db';
import { users } from '@packrat/api/db/schema';
import { ErrorResponseSchema } from '@packrat/api/schemas/catalog';
import {
  UpdateUserRequestSchema,
  UpdateUserResponseSchema,
  UserProfileSchema,
} from '@packrat/api/schemas/users';
import type { Env } from '@packrat/api/types/env';
import type { Variables } from '@packrat/api/types/variables';
import { eq } from 'drizzle-orm';
import { userItemsRoutes } from './items';

const userRoutes = new OpenAPIHono<{
  Bindings: Env;
  Variables: Variables;
}>();

// Get user profile
const getUserProfileRoute = createRoute({
  method: 'get',
  path: '/profile',
  tags: ['Users'],
  summary: 'Get user profile',
  description: 'Get the authenticated user profile information',
  security: [{ bearerAuth: [] }],
  responses: {
    200: {
      description: 'User profile retrieved successfully',
      content: {
        'application/json': {
          schema: UserProfileSchema,
        },
      },
    },
    404: {
      description: 'User not found',
      content: {
        'application/json': {
          schema: ErrorResponseSchema,
        },
      },
    },
    500: {
      description: 'Internal server error',
      content: {
        'application/json': {
          schema: ErrorResponseSchema,
        },
      },
    },
  },
});

userRoutes.openapi(getUserProfileRoute, async (c) => {
  try {
    const auth = c.get('user');

    const db = createDb(c);
    const [user] = await db
      .select({
        id: users.id,
        email: users.email,
        firstName: users.firstName,
        lastName: users.lastName,
        role: users.role,
        emailVerified: users.emailVerified,
        createdAt: users.createdAt,
        updatedAt: users.updatedAt,
      })
      .from(users)
      .where(eq(users.id, auth.userId))
      .limit(1);

    if (!user) {
      return c.json({ error: 'User not found', code: 'USER_NOT_FOUND' }, 404);
    }

    return c.json(
      {
        success: true,
        user: {
          ...user,
          createdAt: user.createdAt?.toISOString() || null,
          updatedAt: user.updatedAt?.toISOString() || null,
        },
      },
      200,
    );
  } catch (error) {
    console.error('Error fetching user profile:', error);
    return c.json(
      {
        error: 'Failed to fetch user profile',
        code: 'FETCH_ERROR',
      },
      500,
    );
  }
});

// Update user profile
const updateUserProfileRoute = createRoute({
  method: 'put',
  path: '/profile',
  tags: ['Users'],
  summary: 'Update user profile',
  description: 'Update the authenticated user profile information',
  security: [{ bearerAuth: [] }],
  request: {
    body: {
      content: {
        'application/json': {
          schema: UpdateUserRequestSchema,
        },
      },
      required: true,
    },
  },
  responses: {
    200: {
      description: 'User profile updated successfully',
      content: {
        'application/json': {
          schema: UpdateUserResponseSchema,
        },
      },
    },
    400: {
      description: 'Bad request - Invalid input data',
      content: {
        'application/json': {
          schema: ErrorResponseSchema,
        },
      },
    },
    404: {
      description: 'User not found',
      content: {
        'application/json': {
          schema: ErrorResponseSchema,
        },
      },
    },
    409: {
      description: 'Conflict - Email already in use by another user',
      content: {
        'application/json': {
          schema: ErrorResponseSchema,
        },
      },
    },
    500: {
      description: 'Internal server error',
      content: {
        'application/json': {
          schema: ErrorResponseSchema,
        },
      },
    },
  },
});

userRoutes.openapi(updateUserProfileRoute, async (c) => {
  try {
    const auth = c.get('user');

    const { firstName, lastName, email } = c.req.valid('json');
    const db = createDb(c);

    // If email is being updated, check if it's already in use
    if (email) {
      const [existingUser] = await db
        .select({ id: users.id })
        .from(users)
        .where(eq(users.email, email.toLowerCase()))
        .limit(1);

      if (existingUser && existingUser.id !== auth.userId) {
        return c.json(
          { error: 'Email already in use by another user', code: 'EMAIL_CONFLICT' },
          409,
        );
      }
    }

    // Prepare update data
    const updateData: Partial<typeof users.$inferInsert> = {
      updatedAt: new Date(),
    };

    if (firstName !== undefined) updateData.firstName = firstName;
    if (lastName !== undefined) updateData.lastName = lastName;
    if (email !== undefined) {
      updateData.email = email.toLowerCase();
      updateData.emailVerified = false; // Reset verification if email changes
    }

    // Update user
    const [updatedUser] = await db
      .update(users)
      .set(updateData)
      .where(eq(users.id, auth.userId))
      .returning();

    if (!updatedUser) {
      return c.json({ error: 'User not found', code: 'USER_NOT_FOUND' }, 404);
    }

    const message = email
      ? 'Profile updated successfully. Please verify your new email address.'
      : 'Profile updated successfully';

    return c.json(
      {
        success: true,
        message,
        user: {
          id: updatedUser.id,
          email: updatedUser.email,
          firstName: updatedUser.firstName,
          lastName: updatedUser.lastName,
          role: updatedUser.role,
          emailVerified: updatedUser.emailVerified,
          createdAt: updatedUser.createdAt?.toISOString() || null,
          updatedAt: updatedUser.updatedAt?.toISOString() || null,
        },
      },
      200,
    );
  } catch (error) {
    console.error('Error updating user profile:', error);
    return c.json(
      {
        error: 'Failed to update user profile',
        code: 'UPDATE_ERROR',
      },
      500,
    );
  }
});

userRoutes.route('/', userItemsRoutes);

export { userRoutes };
