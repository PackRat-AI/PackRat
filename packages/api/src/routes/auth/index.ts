import { createDb } from '@packrat/api/db';
import {
  authProviders,
  oneTimePasswords,
  packs,
  packTemplateItems,
  packTemplates,
  refreshTokens,
  users,
} from '@packrat/api/db/schema';
import { authPlugin } from '@packrat/api/middleware/auth';
import {
  AppleAuthRequestSchema,
  ForgotPasswordRequestSchema,
  GoogleAuthRequestSchema,
  LoginRequestSchema,
  LogoutRequestSchema,
  RefreshTokenRequestSchema,
  RegisterRequestSchema,
  ResetPasswordRequestSchema,
  VerifyEmailRequestSchema,
} from '@packrat/api/schemas/auth';
import {
  generateJWT,
  generateRefreshToken,
  generateVerificationCode,
  hashPassword,
  validateEmail,
  validatePassword,
  verifyPassword,
} from '@packrat/api/utils/auth';
import { sendPasswordResetEmail, sendVerificationCodeEmail } from '@packrat/api/utils/email';
import { getEnv } from '@packrat/api/utils/env-validation';
import { assertDefined } from '@packrat/guards';
import { and, eq, getTableColumns, gt, isNull } from 'drizzle-orm';
import { Elysia, status } from 'elysia';
import { OAuth2Client } from 'google-auth-library';
import { z } from 'zod';

const { passwordHash: _pw, ...userWithoutPassword } = getTableColumns(users);

export const authRoutes = new Elysia({ prefix: '/auth' })
  .use(authPlugin)

  // Login
  .post(
    '/login',
    async ({ body }) => {
      const { email, password } = body;
      const db = createDb();

      if (!email || !password) {
        return status(400, { error: 'Email and password are required' });
      }

      const user = await db
        .select()
        .from(users)
        .where(eq(users.email, email.toLowerCase()))
        .limit(1);

      if (user.length === 0) return status(401, { error: 'Invalid email or password' });

      const userRecord = user[0];
      if (!userRecord) return status(401, { error: 'Invalid email or password' });

      // biome-ignore lint/style/noNonNullAssertion: password hash exists for password auth
      const isPasswordValid = await verifyPassword(password, userRecord.passwordHash!);
      if (!isPasswordValid) return status(401, { error: 'Invalid email or password' });

      if (!userRecord.emailVerified) {
        return status(403, { error: 'Please verify your email before logging in' });
      }

      const refreshToken = generateRefreshToken();
      await db.insert(refreshTokens).values({
        userId: userRecord.id,
        token: refreshToken,
        expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      });

      const accessToken = await generateJWT({
        payload: { userId: userRecord.id, role: userRecord.role },
      });

      const { passwordHash: _ph, ...userPayload } = userRecord;

      return { success: true, accessToken, refreshToken, user: userPayload };
    },
    {
      body: LoginRequestSchema,
      detail: { tags: ['Authentication'], summary: 'User login' },
    },
  )

  // Register
  .post(
    '/register',
    async ({ body }) => {
      const { email, password, firstName, lastName } = body;
      const db = createDb();

      if (!email || !password) {
        return status(400, { error: 'Email and password are required' });
      }
      if (!validateEmail(email)) return status(400, { error: 'Invalid email format' });

      const passwordValidation = validatePassword(password);
      if (!passwordValidation.valid) {
        return status(400, { error: passwordValidation.message || 'Invalid password' });
      }

      const existingUser = await db
        .select()
        .from(users)
        .where(eq(users.email, email.toLowerCase()))
        .limit(1);

      if (existingUser.length > 0) return status(409, { error: 'Email already in use' });

      const passwordHash = await hashPassword(password);
      const [newUser] = await db
        .insert(users)
        .values({
          email: email.toLowerCase(),
          passwordHash,
          firstName,
          lastName,
          emailVerified: false,
        })
        .returning();

      if (!newUser) return status(500, { error: 'Failed to create user' });

      const code = generateVerificationCode(5);
      await db.insert(oneTimePasswords).values({
        userId: newUser.id,
        code,
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
      });

      await sendVerificationCodeEmail({ to: email, code });

      return {
        success: true,
        message:
          'User registered successfully. Please check your email for your verification code.',
        userId: newUser.id,
      };
    },
    {
      body: RegisterRequestSchema,
      detail: { tags: ['Authentication'], summary: 'Register new user' },
    },
  )

  // Verify email
  .post(
    '/verify-email',
    async ({ body }) => {
      const { email, code } = body;
      const db = createDb();

      if (!email || !code) {
        return status(400, { error: 'Email and verification code are required' });
      }

      const user = await db
        .select()
        .from(users)
        .where(eq(users.email, email.toLowerCase()))
        .limit(1);

      if (user.length === 0) return status(404, { error: 'User not found' });

      const userRecord = user[0];
      if (!userRecord) return status(404, { error: 'User not found' });
      assertDefined(userRecord);

      const userId = userRecord.id;

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
        return status(400, { error: 'Invalid or expired verification code' });
      }

      const [finalUser] = await db
        .update(users)
        .set({ emailVerified: true })
        .where(eq(users.id, userId))
        .returning();

      await db.delete(oneTimePasswords).where(eq(oneTimePasswords.userId, userId));

      const refreshToken = generateRefreshToken();
      await db.insert(refreshTokens).values({
        userId: userRecord.id,
        token: refreshToken,
        expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      });

      const accessToken = await generateJWT({
        payload: { userId, role: userRecord.role },
      });

      assertDefined(finalUser);
      const { passwordHash: _passwordHash, ...userPayload } = finalUser;

      return {
        success: true,
        message: 'Email verified successfully',
        accessToken,
        refreshToken,
        user: userPayload,
      };
    },
    {
      body: VerifyEmailRequestSchema,
      detail: { tags: ['Authentication'], summary: 'Verify email address' },
    },
  )

  // Resend verification
  .post(
    '/resend-verification',
    async ({ body }) => {
      const { email } = body;
      if (!email) return status(400, { error: 'Email is required' });

      const db = createDb();
      const user = await db
        .select()
        .from(users)
        .where(eq(users.email, email.toLowerCase()))
        .limit(1);

      if (user.length === 0) return status(404, { error: 'User not found' });

      const userRecord = user[0];
      if (!userRecord) return status(404, { error: 'User not found' });

      const userId = userRecord.id;
      if (userRecord.emailVerified) {
        return status(400, { error: 'Email is already verified' });
      }

      await db.delete(oneTimePasswords).where(eq(oneTimePasswords.userId, userId));

      const code = generateVerificationCode(5);
      await db.insert(oneTimePasswords).values({
        userId,
        code,
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
      });

      await sendVerificationCodeEmail({ to: email, code });

      return { success: true, message: 'Verification code sent successfully' };
    },
    {
      body: z.object({ email: z.string().email() }),
      detail: { tags: ['Authentication'], summary: 'Resend verification code' },
    },
  )

  // Forgot password
  .post(
    '/forgot-password',
    async ({ body }) => {
      const { email } = body;
      const db = createDb();

      if (!email) return status(400, { error: 'Email is required' });

      const user = await db
        .select()
        .from(users)
        .where(eq(users.email, email.toLowerCase()))
        .limit(1);

      const genericResponse = {
        success: true as const,
        message: 'If your email is registered, you will receive a verification code',
      };

      if (user.length === 0) return genericResponse;
      const userRecord = user[0];
      if (!userRecord) return genericResponse;

      const code = generateVerificationCode(5);
      await db.delete(oneTimePasswords).where(eq(oneTimePasswords.userId, userRecord.id));
      await db.insert(oneTimePasswords).values({
        userId: userRecord.id,
        code,
        expiresAt: new Date(Date.now() + 1 * 60 * 60 * 1000),
      });

      await sendPasswordResetEmail({ to: email, code });

      return genericResponse;
    },
    {
      body: ForgotPasswordRequestSchema,
      detail: { tags: ['Authentication'], summary: 'Request password reset' },
    },
  )

  // Reset password
  .post(
    '/reset-password',
    async ({ body }) => {
      const { email, code, newPassword } = body;
      const db = createDb();

      if (!email || !code || !newPassword) {
        return status(400, { error: 'Email, code, and new password are required' });
      }

      const passwordValidation = validatePassword(newPassword);
      if (!passwordValidation.valid) {
        return status(400, { error: passwordValidation.message || 'Invalid password' });
      }

      const userResult = await db
        .select()
        .from(users)
        .where(eq(users.email, email.toLowerCase()))
        .limit(1);

      if (userResult.length === 0) return status(404, { error: 'User not found' });
      const user = userResult[0];
      if (!user) return status(404, { error: 'User not found' });

      const codeRecord = await db
        .select()
        .from(oneTimePasswords)
        .where(and(eq(oneTimePasswords.userId, user.id), eq(oneTimePasswords.code, code)))
        .limit(1);

      if (codeRecord.length === 0) return status(400, { error: 'Invalid verification code' });
      const codeRecordItem = codeRecord[0];
      if (!codeRecordItem) return status(400, { error: 'Invalid verification code' });

      if (new Date() > codeRecordItem.expiresAt) {
        return status(400, { error: 'Verification code has expired' });
      }

      const passwordHash = await hashPassword(newPassword);
      await db.update(users).set({ passwordHash }).where(eq(users.id, user.id));
      await db.delete(oneTimePasswords).where(eq(oneTimePasswords.id, codeRecordItem.id));

      return { success: true, message: 'Password reset successfully' };
    },
    {
      body: ResetPasswordRequestSchema,
      detail: { tags: ['Authentication'], summary: 'Reset password' },
    },
  )

  // Refresh token
  .post(
    '/refresh',
    async ({ body }) => {
      try {
        const { refreshToken } = body;
        if (!refreshToken) return status(400, { error: 'Refresh token is required' });

        const db = createDb();
        const tokenRecord = await db
          .select({
            id: refreshTokens.id,
            userId: refreshTokens.userId,
            expiresAt: refreshTokens.expiresAt,
          })
          .from(refreshTokens)
          .where(and(eq(refreshTokens.token, refreshToken), isNull(refreshTokens.revokedAt)))
          .limit(1);

        if (tokenRecord.length === 0) return status(401, { error: 'Invalid refresh token' });
        const token = tokenRecord[0];
        if (!token) return status(401, { error: 'Invalid refresh token' });
        assertDefined(token);

        if (new Date() > token.expiresAt) return status(401, { error: 'Refresh token expired' });

        const newRefreshToken = generateRefreshToken();
        await db
          .update(refreshTokens)
          .set({ revokedAt: new Date(), replacedByToken: newRefreshToken })
          .where(eq(refreshTokens.id, token.id));

        await db.insert(refreshTokens).values({
          userId: token.userId,
          token: newRefreshToken,
          expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        });

        const [user] = await db
          .select(userWithoutPassword)
          .from(users)
          .where(eq(users.id, token.userId))
          .limit(1);

        if (!user) return status(401, { error: 'User not found' });

        const accessToken = await generateJWT({
          payload: { userId: token.userId, role: user.role },
        });

        return { success: true, accessToken, refreshToken: newRefreshToken, user };
      } catch (error) {
        console.error('Token refresh error:', error);
        return status(401, { error: 'An error occurred during token refresh' });
      }
    },
    {
      body: RefreshTokenRequestSchema,
      detail: { tags: ['Authentication'], summary: 'Refresh access token' },
    },
  )

  // Logout
  .post(
    '/logout',
    async ({ body }) => {
      const db = createDb();
      const { refreshToken } = body;

      if (!refreshToken) return status(400, { error: 'Refresh token is required' });

      await db
        .update(refreshTokens)
        .set({ revokedAt: new Date() })
        .where(eq(refreshTokens.token, refreshToken));

      return { success: true, message: 'Logged out successfully' };
    },
    {
      body: LogoutRequestSchema,
      detail: { tags: ['Authentication'], summary: 'Logout user' },
    },
  )

  // Me
  .get(
    '/me',
    async ({ user }) => {
      const db = createDb();
      const userId = Number(user.userId);
      const userRows = await db
        .select(userWithoutPassword)
        .from(users)
        .where(eq(users.id, userId))
        .limit(1);

      const userRecord = userRows[0];
      if (!userRecord) return status(401, { error: 'Unauthorized' });

      return { success: true, user: userRecord };
    },
    {
      isAuthenticated: true,
      detail: {
        tags: ['Authentication'],
        summary: 'Get current user',
        security: [{ bearerAuth: [] }],
      },
    },
  )

  // Delete account
  .delete(
    '/',
    async ({ user }) => {
      const db = createDb();
      const userId = user.userId;

      await db.delete(refreshTokens).where(eq(refreshTokens.userId, userId));
      await db.delete(oneTimePasswords).where(eq(oneTimePasswords.userId, userId));
      await db.delete(authProviders).where(eq(authProviders.userId, userId));
      await db.delete(packTemplateItems).where(eq(packTemplateItems.userId, userId));
      await db.delete(packTemplates).where(eq(packTemplates.userId, userId));
      await db.delete(packs).where(eq(packs.userId, userId));
      await db.delete(users).where(eq(users.id, userId));

      return { success: true };
    },
    {
      isAuthenticated: true,
      detail: {
        tags: ['Authentication'],
        summary: 'Delete user account',
        security: [{ bearerAuth: [] }],
      },
    },
  )

  // Apple sign-in
  .post(
    '/apple',
    async ({ body }) => {
      const { identityToken } = body;
      const db = createDb();

      let payload: { sub: string; email: string; email_verified: boolean };
      try {
        const part = identityToken.split('.')[1];
        if (!part) throw new Error('invalid');
        payload = JSON.parse(Buffer.from(part, 'base64').toString());
      } catch {
        return status(400, { error: 'Invalid Apple token' });
      }

      const { sub, email, email_verified } = payload;
      if (!sub || !email) return status(400, { error: 'Invalid Apple token' });

      const [existingProvider] = await db
        .select()
        .from(authProviders)
        .where(and(eq(authProviders.provider, 'apple'), eq(authProviders.providerId, sub)))
        .limit(1);

      let userId: number;
      if (existingProvider) {
        userId = existingProvider.userId;
      } else {
        const [existingUser] = await db.select().from(users).where(eq(users.email, email)).limit(1);

        if (existingUser) {
          userId = existingUser.id;
        } else {
          const [newUser] = await db
            .insert(users)
            .values({ email, emailVerified: email_verified || false })
            .returning();
          userId = newUser?.id || 0;
        }

        await db.insert(authProviders).values({
          userId,
          provider: 'apple',
          providerId: sub,
        });
      }

      const [user] = await db
        .select(userWithoutPassword)
        .from(users)
        .where(eq(users.id, userId))
        .limit(1);
      assertDefined(user);

      const refreshToken = generateRefreshToken();
      await db.insert(refreshTokens).values({
        userId,
        token: refreshToken,
        expiresAt: new Date(Date.now() + 30 * 86400 * 1000),
      });

      const accessToken = await generateJWT({
        payload: { userId, role: user?.role || 'USER' },
      });

      return { success: true, accessToken, refreshToken, user };
    },
    {
      body: AppleAuthRequestSchema,
      detail: { tags: ['Authentication'], summary: 'Sign in with Apple' },
    },
  )

  // Google sign-in
  .post(
    '/google',
    async ({ body }) => {
      const { GOOGLE_CLIENT_ID } = getEnv();
      const googleClient = new OAuth2Client(GOOGLE_CLIENT_ID);
      const { idToken } = body;

      if (!idToken) return status(400, { error: 'ID token is required' });

      const db = createDb();

      const ticket = await googleClient.verifyIdToken({
        idToken,
        audience: GOOGLE_CLIENT_ID,
      });

      const payload = ticket.getPayload();
      if (!payload?.email || !payload?.sub) {
        return status(400, { error: 'Invalid Google token' });
      }

      const [existingProvider] = await db
        .select()
        .from(authProviders)
        .where(and(eq(authProviders.provider, 'google'), eq(authProviders.providerId, payload.sub)))
        .limit(1);

      let userId: number;
      let isNewUser = false;

      if (existingProvider) {
        userId = existingProvider.userId;
      } else {
        const [existingUser] = await db
          .select()
          .from(users)
          .where(eq(users.email, payload.email))
          .limit(1);

        if (existingUser) {
          userId = existingUser.id;
          await db.insert(authProviders).values({
            userId,
            provider: 'google',
            providerId: payload.sub,
          });
        } else {
          const [newUser] = await db
            .insert(users)
            .values({
              email: payload.email,
              firstName: payload.given_name,
              lastName: payload.family_name,
              emailVerified: payload.email_verified || false,
            })
            .returning();
          assertDefined(newUser);

          userId = newUser.id;
          isNewUser = true;

          await db.insert(authProviders).values({
            userId,
            provider: 'google',
            providerId: payload.sub,
          });
        }
      }

      const [user] = await db
        .select(userWithoutPassword)
        .from(users)
        .where(eq(users.id, userId))
        .limit(1);
      assertDefined(user);

      const refreshToken = generateRefreshToken();
      await db.insert(refreshTokens).values({
        userId,
        token: refreshToken,
        expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      });

      const accessToken = await generateJWT({
        payload: { userId, role: user.role },
      });

      return { success: true, accessToken, refreshToken, user, isNewUser };
    },
    {
      body: GoogleAuthRequestSchema,
      detail: { tags: ['Authentication'], summary: 'Sign in with Google' },
    },
  );
