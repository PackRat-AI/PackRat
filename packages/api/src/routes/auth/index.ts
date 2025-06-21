import { createDb } from "@/db";
import {
  authProviders,
  oneTimePasswords,
  packs,
  refreshTokens,
  users,
} from '@/db/schema';
import {
  authenticateRequest,
  unauthorizedResponse,
} from '@/utils/api-middleware';
import {
  generateJWT,
  generateRefreshToken,
  generateVerificationCode,
  hashPassword,
  validateEmail,
  validatePassword,
  verifyPassword,
} from '@/utils/auth';
import {
  sendPasswordResetEmail,
  sendVerificationCodeEmail,
} from '@/utils/email';
import { and, eq, gt, isNull } from 'drizzle-orm';
import { OpenAPIHono, createRoute, z } from '@hono/zod-openapi';

const authRoutes = new OpenAPIHono();

// Login route
const loginRoute = createRoute({
  method: 'post',
  path: '/login',
  request: { body: { content: { 'application/json': { schema: z.any() } } } },
  responses: { 200: { description: 'Login' } },
});

authRoutes.openapi(loginRoute, async (c) => {
  try {
    const { email, password } = await c.req.json();
    const db = createDb(c);

    // Validate input
    if (!email || !password) {
      return c.json({ error: 'Email and password are required' }, 400);
    }

    // Find user
    const user = await db
      .select()
      .from(users)
      .where(eq(users.email, email.toLowerCase()))
      .limit(1);

    if (user.length === 0) {
      return c.json({ error: 'Invalid email or password' }, 401);
    }

    // Verify password
    const isPasswordValid = await verifyPassword(
      password,
      user[0].passwordHash!
    );

    if (!isPasswordValid) {
      return c.json({ error: 'Invalid email or password' }, 401);
    }

    // Check if email is verified
    if (!user[0].emailVerified) {
      return c.json(
        { error: 'Please verify your email before logging in' },
        403
      );
    }

    // Generate refresh token
    const refreshToken = generateRefreshToken();

    // Store refresh token
    await db.insert(refreshTokens).values({
      userId: user[0].id,
      token: refreshToken,
      expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days
    });

    // Generate JWT (access token)
    const accessToken = await generateJWT({
      payload: {
        userId: user[0].id,
        exp: Math.floor(Date.now() / 1000) + 60 * 60 * 24 * 7, // 7 days
      },
      c,
    });

    return c.json({
      success: true,
      accessToken,
      refreshToken,
      user: {
        id: user[0].id,
        email: user[0].email,
        firstName: user[0].firstName,
        lastName: user[0].lastName,
        emailVerified: user[0].emailVerified,
      },
    });
  } catch (error) {
    console.error('Login error:', error);
    return c.json({ error: 'An error occurred during login' }, 500);
  }
});

// Register route
const registerRoute = createRoute({
  method: 'post',
  path: '/register',
  request: { body: { content: { 'application/json': { schema: z.any() } } } },
  responses: { 200: { description: 'Register user' } },
});

authRoutes.openapi(registerRoute, async (c) => {
  try {
    const { email, password, firstName, lastName } = await c.req.json();
    const db = createDb(c);

    // Validate input
    if (!email || !password) {
      return c.json({ error: 'Email and password are required' }, 400);
    }

    if (!validateEmail(email)) {
      return c.json({ error: 'Invalid email format' }, 400);
    }

    const passwordValidation = validatePassword(password);
    if (!passwordValidation.valid) {
      return c.json({ error: passwordValidation.message }, 400);
    }

    // Check if user already exists
    const existingUser = await db
      .select()
      .from(users)
      .where(eq(users.email, email.toLowerCase()))
      .limit(1);

    if (existingUser.length > 0) {
      return c.json({ error: 'Email already in use' }, 409);
    }

    // Hash password
    const passwordHash = await hashPassword(password);

    // Create user
    const [newUser] = await db
      .insert(users)
      .values({
        email: email.toLowerCase(),
        passwordHash,
        firstName,
        lastName,
        emailVerified: false,
      })
      .returning({ id: users.id });

    const code = generateVerificationCode(5);

    // Store code in database
    await db.insert(oneTimePasswords).values({
      userId: newUser.id,
      code,
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 hours
    });

    // Send verification email with code
    await sendVerificationCodeEmail({ to: email, code, c });

    return c.json({
      success: true,
      message:
        'User registered successfully. Please check your email for your verification code.',
      userId: newUser.id,
    });
  } catch (error) {
    console.error('Registration error:', error);
    return c.json({ error: 'An error occurred during registration' }, 500);
  }
});

// Verify email route
const verifyEmailRoute = createRoute({
  method: 'post',
  path: '/verify-email',
  request: { body: { content: { 'application/json': { schema: z.any() } } } },
  responses: { 200: { description: 'Verify email' } },
});

authRoutes.openapi(verifyEmailRoute, async (c) => {
  try {
    const { email, code } = await c.req.json();
    const db = createDb(c);

    if (!email || !code) {
      return c.json({ error: 'Email and verification code are required' }, 400);
    }

    // Find the user by email
    const user = await db
      .select()
      .from(users)
      .where(eq(users.email, email.toLowerCase()))
      .limit(1);

    if (user.length === 0) {
      return c.json({ error: 'User not found' }, 404);
    }

    const userId = user[0].id;

    // Find the verification code
    const verificationCode = await db
      .select()
      .from(oneTimePasswords)
      .where(
        and(
          eq(oneTimePasswords.userId, userId),
          eq(oneTimePasswords.code, code),
          gt(oneTimePasswords.expiresAt, new Date())
        )
      )
      .limit(1);

    if (verificationCode.length === 0) {
      return c.json({ error: 'Invalid or expired verification code' }, 400);
    }

    // Update user as verified
    await db
      .update(users)
      .set({ emailVerified: true })
      .where(eq(users.id, userId));

    // Delete the verification code
    await db
      .delete(oneTimePasswords)
      .where(eq(oneTimePasswords.userId, userId));

    // Generate refresh token
    const refreshToken = generateRefreshToken();

    // Store refresh token
    await db.insert(refreshTokens).values({
      userId: user[0].id,
      token: refreshToken,
      expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days
    });

    // Generate JWT token
    const accessToken = await generateJWT({ payload: { userId }, c });

    return c.json({
      success: true,
      message: 'Email verified successfully',
      accessToken,
      refreshToken,
      user: {
        id: user[0].id,
        email: user[0].email,
        firstName: user[0].firstName,
        lastName: user[0].lastName,
        emailVerified: true,
      },
    });
  } catch (error) {
    console.error('Email verification error:', error);
    return c.json(
      { error: 'An error occurred during email verification' },
      500
    );
  }
});

// Resend verification route
const resendVerificationRoute = createRoute({
  method: 'post',
  path: '/resend-verification',
  request: { body: { content: { 'application/json': { schema: z.any() } } } },
  responses: { 200: { description: 'Resend verification code' } },
});

authRoutes.openapi(resendVerificationRoute, async (c) => {
  try {
    const { email } = await c.req.json();

    if (!email) {
      return Response.json({ error: 'Email is required' }, { status: 400 });
    }

    const db = createDb(c);

    // Find the user by email
    const user = await db
      .select()
      .from(users)
      .where(eq(users.email, email.toLowerCase()))
      .limit(1);

    if (user.length === 0) {
      return Response.json({ error: 'User not found' }, { status: 404 });
    }

    const userId = user[0].id;

    // Check if user is already verified
    if (user[0].emailVerified) {
      return Response.json(
        { error: 'Email is already verified' },
        { status: 400 }
      );
    }

    // Delete any existing verification codes
    await db
      .delete(oneTimePasswords)
      .where(eq(oneTimePasswords.userId, userId));

    // Generate new verification code
    const code = generateVerificationCode(5);

    // Store code in database
    await db.insert(oneTimePasswords).values({
      userId,
      code,
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 hours
    });

    // Send verification email with code
    await sendVerificationCodeEmail({ to: email, code, c });

    return Response.json({
      success: true,
      message: 'Verification code sent successfully',
    });
  } catch (error) {
    console.error('Resend verification error:', error);
    return Response.json(
      { error: 'An error occurred while resending verification code' },
      { status: 500 }
    );
  }
});

// Forgot password route
const forgotPasswordRoute = createRoute({
  method: 'post',
  path: '/forgot-password',
  request: { body: { content: { 'application/json': { schema: z.any() } } } },
  responses: { 200: { description: 'Forgot password' } },
});

authRoutes.openapi(forgotPasswordRoute, async (c) => {
  try {
    const { email } = await c.req.json();

    const db = createDb(c);

    if (!email) {
      return Response.json({ error: 'Email is required' }, { status: 400 });
    }

    // Find user
    const user = await db
      .select()
      .from(users)
      .where(eq(users.email, email.toLowerCase()))
      .limit(1);

    // Always return success even if user doesn't exist (security best practice)
    if (user.length === 0) {
      return Response.json({
        success: true,
        message:
          'If your email is registered, you will receive a verification code',
      });
    }

    // Generate verification code
    const code = generateVerificationCode(5);

    // Delete any existing codes for this user
    await db
      .delete(oneTimePasswords)
      .where(eq(oneTimePasswords.userId, user[0].id));

    // Store code in database
    await db.insert(oneTimePasswords).values({
      userId: user[0].id,
      code,
      expiresAt: new Date(Date.now() + 1 * 60 * 60 * 1000), // 1 hour
    });

    // Send password reset email with code
    await sendPasswordResetEmail({ to: email, code, c });

    return Response.json({
      success: true,
      message:
        'If your email is registered, you will receive a verification code',
    });
  } catch (error) {
    console.error('Forgot password error:', error);
    return Response.json({ error: 'An error occurred' }, { status: 500 });
  }
});

// Reset password route
const resetPasswordRoute = createRoute({
  method: 'post',
  path: '/reset-password',
  request: { body: { content: { 'application/json': { schema: z.any() } } } },
  responses: { 200: { description: 'Reset password' } },
});

authRoutes.openapi(resetPasswordRoute, async (c) => {
  try {
    const { email, code, newPassword } = await c.req.json();

    const db = createDb(c);

    if (!email || !code || !newPassword) {
      return Response.json(
        { error: 'Email, code, and new password are required' },
        { status: 400 }
      );
    }

    // Validate password
    const passwordValidation = validatePassword(newPassword);
    if (!passwordValidation.valid) {
      return Response.json(
        { error: passwordValidation.message },
        { status: 400 }
      );
    }

    // Find user by email
    const userResult = await db
      .select()
      .from(users)
      .where(eq(users.email, email.toLowerCase()))
      .limit(1);

    if (userResult.length === 0) {
      return Response.json({ error: 'User not found' }, { status: 404 });
    }

    const user = userResult[0];

    // Find verification code
    const codeRecord = await db
      .select()
      .from(oneTimePasswords)
      .where(
        and(
          eq(oneTimePasswords.userId, user.id),
          eq(oneTimePasswords.code, code)
        )
      )
      .limit(1);

    if (codeRecord.length === 0) {
      return Response.json(
        { error: 'Invalid verification code' },
        { status: 400 }
      );
    }

    // Check if code is expired
    if (new Date() > codeRecord[0].expiresAt) {
      return Response.json(
        { error: 'Verification code has expired' },
        { status: 400 }
      );
    }

    // Hash new password
    const passwordHash = await hashPassword(newPassword);

    // Update user's password
    await db.update(users).set({ passwordHash }).where(eq(users.id, user.id));

    // Delete the used verification code
    await db
      .delete(oneTimePasswords)
      .where(eq(oneTimePasswords.id, codeRecord[0].id));

    return Response.json({
      success: true,
      message: 'Password reset successfully',
    });
  } catch (error) {
    console.error('Reset password error:', error);
    return Response.json(
      { error: 'An error occurred during password reset' },
      { status: 500 }
    );
  }
});

// Refresh token route
const refreshTokenRoute = createRoute({
  method: 'post',
  path: '/refresh',
  request: { body: { content: { 'application/json': { schema: z.any() } } } },
  responses: { 200: { description: 'Refresh token' } },
});

authRoutes.openapi(refreshTokenRoute, async (c) => {
  try {
    const { refreshToken } = await c.req.json();

    if (!refreshToken) {
      return c.json({ error: 'Refresh token is required' }, 400);
    }

    const db = createDb(c);

    // Find the refresh token in the database
    const tokenRecord = await db
      .select({
        id: refreshTokens.id,
        userId: refreshTokens.userId,
        expiresAt: refreshTokens.expiresAt,
      })
      .from(refreshTokens)
      .where(
        and(
          eq(refreshTokens.token, refreshToken),
          isNull(refreshTokens.revokedAt)
        )
      )
      .limit(1);

    if (tokenRecord.length === 0) {
      return c.json({ error: 'Invalid refresh token' }, 401);
    }

    const token = tokenRecord[0];

    // Check if token is expired
    if (new Date() > token.expiresAt) {
      return c.json({ error: 'Refresh token expired' }, 401);
    }

    // Generate new refresh token
    const newRefreshToken = generateRefreshToken();

    // Revoke old refresh token and create new one
    await db
      .update(refreshTokens)
      .set({
        revokedAt: new Date(),
        replacedByToken: newRefreshToken,
      })
      .where(eq(refreshTokens.id, token.id));

    // Store new refresh token
    await db.insert(refreshTokens).values({
      userId: token.userId,
      token: newRefreshToken,
      expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days
    });

    // Generate new access token
    const accessToken = await generateJWT({
      payload: { userId: token.userId },
      c,
    });

    // Get user info
    const user = await db
      .select({
        id: users.id,
        email: users.email,
        firstName: users.firstName,
        lastName: users.lastName,
        emailVerified: users.emailVerified,
      })
      .from(users)
      .where(eq(users.id, token.userId))
      .limit(1);

    return c.json({
      success: true,
      accessToken,
      refreshToken: newRefreshToken,
      user: user[0],
    });
  } catch (error) {
    console.error('Token refresh error:', error);
    return c.json({ error: 'An error occurred during token refresh' }, 500);
  }
});

// Logout route
const logoutRoute = createRoute({
  method: 'post',
  path: '/logout',
  request: { body: { content: { 'application/json': { schema: z.any() } } } },
  responses: { 200: { description: 'Logout' } },
});

authRoutes.openapi(logoutRoute, async (c) => {
  try {
    const db = createDb(c);

    // Get refresh token from request body
    const { refreshToken } = await c.req.json();

    if (!refreshToken) {
      return c.json({ error: 'Refresh token is required' }, 400);
    }

    // Revoke the refresh token
    await db
      .update(refreshTokens)
      .set({ revokedAt: new Date() })
      .where(eq(refreshTokens.token, refreshToken));

    return c.json({
      success: true,
      message: 'Logged out successfully',
    });
  } catch (error) {
    console.error('Logout error:', error);
    return c.json({ error: 'An error occurred during logout' }, 500);
  }
});

// Me route
const meRoute = createRoute({
  method: 'get',
  path: '/me',
  responses: { 200: { description: 'Get current user' } },
});

authRoutes.openapi(meRoute, async (c) => {
  try {
    const auth = await authenticateRequest(c);
    const db = createDb(c);

    if (!auth) {
      return unauthorizedResponse();
    }

    // Find user
    const user = await db
      .select({
        id: users.id,
        email: users.email,
        firstName: users.firstName,
        lastName: users.lastName,
        emailVerified: users.emailVerified,
      })
      .from(users)
      .where(eq(users.id, auth.userId))
      .limit(1);

    if (user.length === 0) {
      return c.json({ error: 'User not found' }, 404);
    }

    return c.json({
      success: true,
      user: user[0],
    });
  } catch (error) {
    console.error('Get user info error:', error);
    return c.json({ error: 'An error occurred' }, 500);
  }
});

authRoutes.delete('/', async (c) => {
  const auth = await authenticateRequest(c);
  if (!auth) {
    return unauthorizedResponse();
  }
  const db = createDb(c);

  const userId = auth.userId;

  // Delete all user-related data in the correct order to respect foreign key constraints

  // First, delete all refresh tokens
  await db.delete(refreshTokens).where(eq(refreshTokens.userId, userId));

  // Delete one-time passwords
  await db.delete(oneTimePasswords).where(eq(oneTimePasswords.userId, userId));

  // Delete auth providers
  await db.delete(authProviders).where(eq(authProviders.userId, userId));

  // Delete all user's packs (cascade will delete pack items)
  await db.delete(packs).where(eq(packs.userId, userId));

  // Finally, delete the user
  await db.delete(users).where(eq(users.id, userId));

  return c.json({ success: true });
});

export { authRoutes };
