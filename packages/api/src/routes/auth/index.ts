import { createRoute, OpenAPIHono, z } from '@hono/zod-openapi';
import { createDb } from '@packrat/api/db';
import {
  authProviders,
  oneTimePasswords,
  packs,
  refreshTokens,
  users,
} from '@packrat/api/db/schema';
import {
  AppleAuthRequestSchema,
  ErrorResponseSchema,
  ForgotPasswordRequestSchema,
  ForgotPasswordResponseSchema,
  GoogleAuthRequestSchema,
  LoginRequestSchema,
  LoginResponseSchema,
  LogoutRequestSchema,
  LogoutResponseSchema,
  MeResponseSchema,
  RefreshTokenRequestSchema,
  RefreshTokenResponseSchema,
  RegisterRequestSchema,
  RegisterResponseSchema,
  ResetPasswordRequestSchema,
  ResetPasswordResponseSchema,
  SocialAuthResponseSchema,
  VerifyEmailRequestSchema,
  VerifyEmailResponseSchema,
} from '@packrat/api/schemas/auth';
import type { Variables } from '@packrat/api/types/variables';
import {
  generateJWT,
  generateRefreshToken,
  generateVerificationCode,
  hashPassword,
  validateEmail,
  validatePassword,
  verifyJWT,
  verifyPassword,
} from '@packrat/api/utils/auth';
import { sendPasswordResetEmail, sendVerificationCodeEmail } from '@packrat/api/utils/email';
import type { Env } from '@packrat/api/types/env';
import { getEnv } from '@packrat/api/utils/env-validation';
import { assertDefined } from '@packrat/api/utils/typeAssertions';
import { and, eq, gt, isNull } from 'drizzle-orm';
import { OAuth2Client } from 'google-auth-library';

const authRoutes = new OpenAPIHono<{
  Bindings: Env;
  Variables: Variables;
}>();
// Login route
const loginRoute = createRoute({
  method: 'post',
  path: '/login',
  tags: ['Authentication'],
  summary: 'User login',
  description: 'Authenticate a user with email and password to receive access and refresh tokens',
  request: {
    body: {
      content: {
        'application/json': {
          schema: LoginRequestSchema,
        },
      },
      required: true,
    },
  },
  responses: {
    200: {
      description: 'Successful login',
      content: {
        'application/json': {
          schema: LoginResponseSchema,
        },
      },
    },
    400: {
      description: 'Invalid request',
      content: {
        'application/json': {
          schema: ErrorResponseSchema,
        },
      },
    },
    401: {
      description: 'Invalid credentials',
      content: {
        'application/json': {
          schema: ErrorResponseSchema,
        },
      },
    },
    403: {
      description: 'Email not verified',
      content: {
        'application/json': {
          schema: ErrorResponseSchema,
        },
      },
    },
  },
});

authRoutes.openapi(loginRoute, async (c) => {
  const { email, password } = await c.req.json();
  const db = createDb(c);

  // Validate input
  if (!email || !password) {
    return c.json({ error: 'Email and password are required' }, 400);
  }

  // Find user
  const user = await db.select().from(users).where(eq(users.email, email.toLowerCase())).limit(1);

  if (user.length === 0) {
    return c.json({ error: 'Invalid email or password' }, 401);
  }

  const userRecord = user[0];
  if (!userRecord) {
    return c.json({ error: 'Invalid email or password' }, 401);
  }

  // Verify password
  // biome-ignore lint/style/noNonNullAssertion: at this point, password hash would definitely not be null
  const isPasswordValid = await verifyPassword(password, userRecord.passwordHash!);

  if (!isPasswordValid) {
    return c.json({ error: 'Invalid email or password' }, 401);
  }

  // Check if email is verified
  if (!userRecord.emailVerified) {
    return c.json({ error: 'Please verify your email before logging in' }, 403);
  }

  // Generate refresh token
  const refreshToken = generateRefreshToken();

  // Store refresh token
  await db.insert(refreshTokens).values({
    userId: userRecord.id,
    token: refreshToken,
    expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days
  });

  // Generate JWT (access token)
  const accessToken = await generateJWT({
    payload: {
      userId: userRecord.id,
      exp: Math.floor(Date.now() / 1000) + 60 * 60 * 24 * 7, // 7 days
    },
    c,
  });

  return c.json(
    {
      success: true,
      accessToken,
      refreshToken,
      user: {
        id: userRecord.id,
        email: userRecord.email,
        firstName: userRecord.firstName,
        lastName: userRecord.lastName,
        emailVerified: userRecord.emailVerified,
      },
    },
    200,
  );
});

// Register route
const registerRoute = createRoute({
  method: 'post',
  path: '/register',
  tags: ['Authentication'],
  summary: 'Register new user',
  description: 'Create a new user account and send verification email',
  request: {
    body: {
      content: {
        'application/json': {
          schema: RegisterRequestSchema,
        },
      },
      required: true,
    },
  },
  responses: {
    200: {
      description: 'User registered successfully',
      content: {
        'application/json': {
          schema: RegisterResponseSchema,
        },
      },
    },
    400: {
      description: 'Invalid request data',
      content: {
        'application/json': {
          schema: ErrorResponseSchema,
        },
      },
    },
    409: {
      description: 'Email already in use',
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

authRoutes.openapi(registerRoute, async (c) => {
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
    return c.json({ error: passwordValidation.message || 'Invalid password' }, 400);
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

  if (!newUser) {
    return c.json({ error: 'Failed to create user' }, 500);
  }

  const code = generateVerificationCode(5);

  // Store code in database
  await db.insert(oneTimePasswords).values({
    userId: newUser.id,
    code,
    expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 hours
  });

  // Send verification email with code
  await sendVerificationCodeEmail({ to: email, code, c });

  return c.json(
    {
      success: true,
      message: 'User registered successfully. Please check your email for your verification code.',
      userId: newUser.id,
    },
    200,
  );
});

// Verify email route
const verifyEmailRoute = createRoute({
  method: 'post',
  path: '/verify-email',
  tags: ['Authentication'],
  summary: 'Verify email address',
  description: 'Verify user email with the code sent to their email address',
  request: {
    body: {
      content: {
        'application/json': {
          schema: VerifyEmailRequestSchema,
        },
      },
      required: true,
    },
  },
  responses: {
    200: {
      description: 'Email verified successfully',
      content: {
        'application/json': {
          schema: VerifyEmailResponseSchema,
        },
      },
    },
    400: {
      description: 'Invalid or expired verification code',
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
  },
});

authRoutes.openapi(verifyEmailRoute, async (c) => {
  const { email, code } = await c.req.json();
  const db = createDb(c);

  if (!email || !code) {
    return c.json({ error: 'Email and verification code are required' }, 400);
  }

  // Find the user by email
  const user = await db.select().from(users).where(eq(users.email, email.toLowerCase())).limit(1);

  if (user.length === 0) {
    return c.json({ error: 'User not found' }, 404);
  }

  const userRecord = user[0];
  if (!userRecord) {
    return c.json({ error: 'User not found' }, 404);
  }
  assertDefined(userRecord);

  const userId = userRecord.id;

  // Find the verification code
  const verificationCode = await db
    .select()
    .from(oneTimePasswords)
    .where(
      and(
        eq(oneTimePasswords.userId, userId),
        eq(oneTimePasswords.code, code),
        gt(oneTimePasswords.expiresAt, new Date()),
      ),
    )
    .limit(1);

  if (verificationCode.length === 0) {
    return c.json({ error: 'Invalid or expired verification code' }, 400);
  }

  // Update user as verified
  await db.update(users).set({ emailVerified: true }).where(eq(users.id, userId));

  // Delete the verification code
  await db.delete(oneTimePasswords).where(eq(oneTimePasswords.userId, userId));

  // Generate refresh token
  const refreshToken = generateRefreshToken();

  // Store refresh token
  await db.insert(refreshTokens).values({
    userId: userRecord.id,
    token: refreshToken,
    expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days
  });

  // Generate JWT token
  const accessToken = await generateJWT({
    payload: {
      userId,
      role: userRecord.role,
    },
    c,
  });

  return c.json(
    {
      success: true,
      message: 'Email verified successfully',
      accessToken,
      refreshToken,
      user: {
        id: userRecord.id,
        email: userRecord.email,
        firstName: userRecord.firstName,
        lastName: userRecord.lastName,
        emailVerified: true,
      },
    },
    200,
  );
});

// Resend verification route
const resendVerificationRoute = createRoute({
  method: 'post',
  path: '/resend-verification',
  tags: ['Authentication'],
  summary: 'Resend verification code',
  description: 'Resend email verification code to the user',
  request: {
    body: {
      content: {
        'application/json': {
          schema: z.object({
            email: z.string().email(),
          }),
        },
      },
      required: true,
    },
  },
  responses: {
    200: {
      description: 'Verification code sent',
      content: {
        'application/json': {
          schema: z.object({
            success: z.boolean(),
            message: z.string(),
          }),
        },
      },
    },
    400: {
      description: 'Invalid request',
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
  },
});

authRoutes.openapi(resendVerificationRoute, async (c) => {
  const { email } = await c.req.json();

  if (!email) {
    return c.json({ error: 'Email is required' }, 400);
  }

  const db = createDb(c);

  // Find the user by email
  const user = await db.select().from(users).where(eq(users.email, email.toLowerCase())).limit(1);

  if (user.length === 0) {
    return c.json({ error: 'User not found' }, 404);
  }

  const userRecord = user[0];
  if (!userRecord) {
    return c.json({ error: 'User not found' }, 404);
  }

  const userId = userRecord.id;

  // Check if user is already verified
  if (userRecord.emailVerified) {
    return c.json({ error: 'Email is already verified' }, 400);
  }

  // Delete any existing verification codes
  await db.delete(oneTimePasswords).where(eq(oneTimePasswords.userId, userId));

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

  return c.json(
    {
      success: true,
      message: 'Verification code sent successfully',
    },
    200,
  );
});

// Forgot password route
const forgotPasswordRoute = createRoute({
  method: 'post',
  path: '/forgot-password',
  tags: ['Authentication'],
  summary: 'Request password reset',
  description: 'Send a password reset verification code to the user email',
  request: {
    body: {
      content: {
        'application/json': {
          schema: ForgotPasswordRequestSchema,
        },
      },
      required: true,
    },
  },
  responses: {
    200: {
      description: 'Password reset code sent if email exists',
      content: {
        'application/json': {
          schema: ForgotPasswordResponseSchema,
        },
      },
    },
    400: {
      description: 'Invalid request',
      content: {
        'application/json': {
          schema: ErrorResponseSchema,
        },
      },
    },
  },
});

authRoutes.openapi(forgotPasswordRoute, async (c) => {
  const { email } = await c.req.json();

  const db = createDb(c);

  if (!email) {
    return c.json({ error: 'Email is required' }, 400);
  }

  // Find user
  const user = await db.select().from(users).where(eq(users.email, email.toLowerCase())).limit(1);

  // Always return success even if user doesn't exist (security best practice)
  if (user.length === 0) {
    return c.json(
      {
        success: true,
        message: 'If your email is registered, you will receive a verification code',
      },
      200,
    );
  }

  const userRecord = user[0];
  if (!userRecord) {
    return c.json(
      {
        success: true,
        message: 'If your email is registered, you will receive a verification code',
      },
      200,
    );
  }

  // Generate verification code
  const code = generateVerificationCode(5);

  // Delete any existing codes for this user
  await db.delete(oneTimePasswords).where(eq(oneTimePasswords.userId, userRecord.id));

  // Store code in database
  await db.insert(oneTimePasswords).values({
    userId: userRecord.id,
    code,
    expiresAt: new Date(Date.now() + 1 * 60 * 60 * 1000), // 1 hour
  });

  // Send password reset email with code
  await sendPasswordResetEmail({ to: email, code, c });

  return c.json(
    {
      success: true,
      message: 'If your email is registered, you will receive a verification code',
    },
    200,
  );
});

// Reset password route
const resetPasswordRoute = createRoute({
  method: 'post',
  path: '/reset-password',
  tags: ['Authentication'],
  summary: 'Reset password',
  description: 'Reset user password using verification code',
  request: {
    body: {
      content: {
        'application/json': {
          schema: ResetPasswordRequestSchema,
        },
      },
      required: true,
    },
  },
  responses: {
    200: {
      description: 'Password reset successfully',
      content: {
        'application/json': {
          schema: ResetPasswordResponseSchema,
        },
      },
    },
    400: {
      description: 'Invalid request or expired code',
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
  },
});

authRoutes.openapi(resetPasswordRoute, async (c) => {
  const { email, code, newPassword } = await c.req.json();

  const db = createDb(c);

  if (!email || !code || !newPassword) {
    return c.json({ error: 'Email, code, and new password are required' }, 400);
  }

  // Validate password
  const passwordValidation = validatePassword(newPassword);
  if (!passwordValidation.valid) {
    return c.json({ error: passwordValidation.message || 'Invalid password' }, 400);
  }

  // Find user by email
  const userResult = await db
    .select()
    .from(users)
    .where(eq(users.email, email.toLowerCase()))
    .limit(1);

  if (userResult.length === 0) {
    return c.json({ error: 'User not found' }, 404);
  }

  const user = userResult[0];
  if (!user) {
    return c.json({ error: 'User not found' }, 404);
  }

  // Find verification code
  const codeRecord = await db
    .select()
    .from(oneTimePasswords)
    .where(and(eq(oneTimePasswords.userId, user.id), eq(oneTimePasswords.code, code)))
    .limit(1);

  if (codeRecord.length === 0) {
    return c.json({ error: 'Invalid verification code' }, 400);
  }

  const codeRecordItem = codeRecord[0];
  if (!codeRecordItem) {
    return c.json({ error: 'Invalid verification code' }, 400);
  }

  // Check if code is expired
  if (new Date() > codeRecordItem.expiresAt) {
    return c.json({ error: 'Verification code has expired' }, 400);
  }

  // Hash new password
  const passwordHash = await hashPassword(newPassword);

  // Update user's password
  await db.update(users).set({ passwordHash }).where(eq(users.id, user.id));

  // Delete the used verification code
  await db.delete(oneTimePasswords).where(eq(oneTimePasswords.id, codeRecordItem.id));

  return c.json(
    {
      success: true,
      message: 'Password reset successfully',
    },
    200,
  );
});

// Refresh token route
const refreshTokenRoute = createRoute({
  method: 'post',
  path: '/refresh',
  tags: ['Authentication'],
  summary: 'Refresh access token',
  description: 'Exchange a refresh token for new access and refresh tokens',
  request: {
    body: {
      content: {
        'application/json': {
          schema: RefreshTokenRequestSchema,
        },
      },
      required: true,
    },
  },
  responses: {
    200: {
      description: 'Tokens refreshed successfully',
      content: {
        'application/json': {
          schema: RefreshTokenResponseSchema,
        },
      },
    },
    400: {
      description: 'Invalid request',
      content: {
        'application/json': {
          schema: ErrorResponseSchema,
        },
      },
    },
    401: {
      description: 'Invalid or expired refresh token',
      content: {
        'application/json': {
          schema: ErrorResponseSchema,
        },
      },
    },
  },
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
      .where(and(eq(refreshTokens.token, refreshToken), isNull(refreshTokens.revokedAt)))
      .limit(1);

    if (tokenRecord.length === 0) {
      return c.json({ error: 'Invalid refresh token' }, 401);
    }

    const token = tokenRecord[0];
    if (!token) {
      return c.json({ error: 'Invalid refresh token' }, 401);
    }
    assertDefined(token);

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

    // Get user info
    const [user] = await db
      .select({
        id: users.id,
        email: users.email,
        firstName: users.firstName,
        lastName: users.lastName,
        emailVerified: users.emailVerified,
        role: users.role,
      })
      .from(users)
      .where(eq(users.id, token.userId))
      .limit(1);

    if (!user) {
      return c.json({ error: 'User not found' }, 404);
    }

    // Generate new access token
    const accessToken = await generateJWT({
      payload: {
        userId: token.userId,
        role: user.role,
      },
      c,
    });

    return c.json(
      {
        success: true,
        accessToken,
        refreshToken: newRefreshToken,
        user,
      },
      200,
    );
  } catch (error) {
    console.error('Token refresh error:', error);
    return c.json({ error: 'An error occurred during token refresh' }, 500);
  }
});

// Logout route
const logoutRoute = createRoute({
  method: 'post',
  path: '/logout',
  tags: ['Authentication'],
  summary: 'Logout user',
  description: 'Revoke the refresh token to logout the user',
  request: {
    body: {
      content: {
        'application/json': {
          schema: LogoutRequestSchema,
        },
      },
      required: true,
    },
  },
  responses: {
    200: {
      description: 'Logged out successfully',
      content: {
        'application/json': {
          schema: LogoutResponseSchema,
        },
      },
    },
    400: {
      description: 'Invalid request',
      content: {
        'application/json': {
          schema: ErrorResponseSchema,
        },
      },
    },
  },
});

authRoutes.openapi(logoutRoute, async (c) => {
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

  return c.json(
    {
      success: true,
      message: 'Logged out successfully',
    },
    200,
  );
});

// Me route
const meRoute = createRoute({
  method: 'get',
  path: '/me',
  tags: ['Authentication'],
  summary: 'Get current user',
  description: 'Get the authenticated user information',
  security: [{ bearerAuth: [] }],
  responses: {
    200: {
      description: 'Current user information',
      content: {
        'application/json': {
          schema: MeResponseSchema,
        },
      },
    },
    401: {
      description: 'Unauthorized',
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
  },
});

authRoutes.openapi(meRoute, async (c) => {
  try {
    // Extract JWT from Authorization header
    const authHeader = c.req.header('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return c.json({ error: 'Unauthorized' }, 401);
    }

    const token = authHeader.substring(7);
    const auth = await verifyJWT({ token, c });
    const db = createDb(c);

    if (!auth) {
      return c.json({ error: 'Unauthorized' }, 401);
    }

    // Find user
    const userId = Number(auth.userId);
    const user = await db
      .select({
        id: users.id,
        email: users.email,
        firstName: users.firstName,
        lastName: users.lastName,
        emailVerified: users.emailVerified,
      })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);

    if (user.length === 0) {
      return c.json({ error: 'User not found' }, 404);
    }

    const userRecord = user[0];
    if (!userRecord) {
      return c.json({ error: 'User not found' }, 404);
    }

    return c.json(
      {
        success: true,
        user: userRecord,
      },
      200,
    );
  } catch (error) {
    console.error('Get user info error:', error);
    return c.json({ error: 'An error occurred' }, 500);
  }
});

// Delete account route
const deleteAccountRoute = createRoute({
  method: 'delete',
  path: '/',
  tags: ['Authentication'],
  summary: 'Delete user account',
  description: 'Permanently delete the authenticated user account and all associated data',
  security: [{ bearerAuth: [] }],
  responses: {
    200: {
      description: 'Account deleted successfully',
      content: {
        'application/json': {
          schema: z.object({ success: z.boolean() }),
        },
      },
    },
    401: {
      description: 'Unauthorized',
      content: {
        'application/json': {
          schema: ErrorResponseSchema,
        },
      },
    },
  },
});
authRoutes.openapi(deleteAccountRoute, async (c) => {
  // Extract JWT from Authorization header
  const authHeader = c.req.header('Authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return c.json({ error: 'Unauthorized' }, 401);
  }

  const token = authHeader.substring(7);
  const auth = await verifyJWT({ token, c });
  if (!auth) {
    return c.json({ error: 'Unauthorized' }, 401);
  }
  const db = createDb(c);

  const userId = auth.userId as number;

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

  return c.json({ success: true }, 200);
});

const appleRoute = createRoute({
  method: 'post',
  path: '/apple',
  tags: ['Authentication'],
  summary: 'Sign in with Apple',
  description: 'Authenticate or register a user using Sign in with Apple',
  request: {
    body: {
      content: {
        'application/json': {
          schema: AppleAuthRequestSchema,
        },
      },
      required: true,
    },
  },
  responses: {
    200: {
      description: 'Authentication successful',
      content: {
        'application/json': {
          schema: SocialAuthResponseSchema,
        },
      },
    },
    400: {
      description: 'Invalid Apple token',
      content: {
        'application/json': {
          schema: ErrorResponseSchema,
        },
      },
    },
  },
});

authRoutes.openapi(appleRoute, async (c) => {
  const { identityToken } = await c.req.json();
  const db = createDb(c);

  // Decode the identity token (JWT)
  const payload = JSON.parse(Buffer.from(identityToken.split('.')[1], 'base64').toString());

  const { sub, email, email_verified } = payload;
  if (!sub || !email) {
    return c.json({ error: 'Invalid Apple token' }, 400);
  }

  // Check if user exists with this Apple ID
  const [existingProvider] = await db
    .select()
    .from(authProviders)
    .where(and(eq(authProviders.provider, 'apple'), eq(authProviders.providerId, sub)))
    .limit(1);

  let userId: number;
  if (existingProvider) {
    userId = existingProvider.userId;
  } else {
    // Check if user exists with this email
    const [existingUser] = await db.select().from(users).where(eq(users.email, email)).limit(1);

    if (existingUser) {
      userId = existingUser.id;
    } else {
      const [newUser] = await db
        .insert(users)
        .values({
          email,
          emailVerified: email_verified || false,
        })
        .returning({ id: users.id });
      userId = newUser?.id || 0;
    }

    await db.insert(authProviders).values({
      userId,
      provider: 'apple',
      providerId: sub,
    });
  }

  const [user] = await db
    .select({
      id: users.id,
      email: users.email,
      firstName: users.firstName,
      lastName: users.lastName,
      emailVerified: users.emailVerified,
      role: users.role,
    })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);

  const refreshToken = generateRefreshToken();
  await db.insert(refreshTokens).values({
    userId,
    token: refreshToken,
    expiresAt: new Date(Date.now() + 30 * 86400 * 1000),
  });

  const accessToken = await generateJWT({
    payload: { userId, role: user?.role || 'USER' },
    c,
  });

  return c.json(
    {
      success: true,
      accessToken,
      refreshToken,
      user,
    },
    200,
  );
});

const googleRoute = createRoute({
  method: 'post',
  path: '/google',
  tags: ['Authentication'],
  summary: 'Sign in with Google',
  description: 'Authenticate or register a user using Google Sign-In',
  request: {
    body: {
      content: {
        'application/json': {
          schema: GoogleAuthRequestSchema,
        },
      },
      required: true,
    },
  },
  responses: {
    200: {
      description: 'Authentication successful',
      content: {
        'application/json': {
          schema: SocialAuthResponseSchema,
        },
      },
    },
    400: {
      description: 'Invalid Google token',
      content: {
        'application/json': {
          schema: ErrorResponseSchema,
        },
      },
    },
  },
});

authRoutes.openapi(googleRoute, async (c) => {
  const { GOOGLE_CLIENT_ID } = getEnv(c);
  const googleClient = new OAuth2Client(GOOGLE_CLIENT_ID);

  const { idToken } = await c.req.json();

  if (!idToken) {
    return c.json({ error: 'ID token is required' }, 400);
  }

  const db = createDb(c);

  // Verify Google ID token
  const ticket = await googleClient.verifyIdToken({
    idToken,
    audience: GOOGLE_CLIENT_ID,
  });

  const payload = ticket.getPayload();

  if (!payload || !payload.email || !payload.sub) {
    return c.json({ error: 'Invalid Google token' }, 400);
  }

  // Check if user exists with this Google ID
  const [existingProvider] = await db
    .select()
    .from(authProviders)
    .where(and(eq(authProviders.provider, 'google'), eq(authProviders.providerId, payload.sub)))
    .limit(1);

  let userId: number;
  let isNewUser = false;

  if (existingProvider) {
    // User exists, get user ID
    userId = existingProvider.userId;
  } else {
    // Check if user exists with this email
    const [existingUser] = await db
      .select()
      .from(users)
      .where(eq(users.email, payload.email))
      .limit(1);

    if (existingUser) {
      // User exists with this email, link Google account
      userId = existingUser.id;

      await db.insert(authProviders).values({
        userId,
        provider: 'google',
        providerId: payload.sub,
      });
    } else {
      // Create new user
      const [newUser] = await db
        .insert(users)
        .values({
          email: payload.email,
          firstName: payload.given_name,
          lastName: payload.family_name,
          emailVerified: payload.email_verified || false,
        })
        .returning({ id: users.id });
      assertDefined(newUser);

      userId = newUser.id;
      isNewUser = true;

      // Link Google account
      await db.insert(authProviders).values({
        userId,
        provider: 'google',
        providerId: payload.sub,
      });
    }
  }

  // Get user info
  const [user] = await db
    .select({
      id: users.id,
      email: users.email,
      firstName: users.firstName,
      lastName: users.lastName,
      emailVerified: users.emailVerified,
      role: users.role,
    })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);
  assertDefined(user);

  // Generate refresh token
  const refreshToken = generateRefreshToken();

  // Store refresh token
  await db.insert(refreshTokens).values({
    userId,
    token: refreshToken,
    expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days
  });

  // Generate JWT (access token)
  const accessToken = await generateJWT({
    payload: { userId, role: user.role },
    c,
  });

  return c.json(
    {
      success: true,
      accessToken,
      refreshToken,
      user,
      isNewUser,
    },
    200,
  );
});

export { authRoutes };
