import { createDb } from '@packrat/api/db';
import {
  requestPasswordReset,
  verifyOtpAndResetPassword,
} from '@packrat/api/services/passwordResetService';
import { getEnv } from '@packrat/api/utils/env-validation';
import { verification } from '@packrat/db';
import { ForgotPasswordRequestSchema, ResetPasswordRequestSchema } from '@packrat/schemas/auth';
import { eq } from 'drizzle-orm';
import { Elysia, status } from 'elysia';
import { z } from 'zod';

export const passwordResetRoutes = new Elysia({ prefix: '/password-reset' })
  .get(
    '/e2e-code',
    async ({ query }) => {
      if (getEnv().ENVIRONMENT !== 'development') {
        return status(404, { error: 'Not found' });
      }

      const db = createDb();
      const identifier = `password-reset:${query.email}`;
      const record = await db.query.verification.findFirst({
        where: eq(verification.identifier, identifier),
      });

      return { code: record?.value ?? null };
    },
    {
      query: z.object({ email: z.string().email() }),
      detail: {
        tags: ['Auth'],
        summary: 'Get password reset code for E2E',
        description:
          'Development-only helper for Playwright to read the reset code from the live DB.',
      },
    },
  )
  // public-route: unauthenticated users need this to initiate a password reset
  .post(
    '/request',
    async ({ body }) => {
      await requestPasswordReset(body.email);
      return { success: true, message: 'If an account exists, a reset code has been sent.' };
    },
    {
      body: ForgotPasswordRequestSchema,
      detail: {
        tags: ['Auth'],
        summary: 'Request password reset',
        description:
          'Send a 6-digit OTP to the user email. Always returns success to prevent email enumeration.',
      },
    },
  )
  // public-route: unauthenticated users need this to verify OTP and set a new password
  .post(
    '/verify',
    async ({ body }) => {
      try {
        await verifyOtpAndResetPassword(body);
        return { success: true, message: 'Password reset successfully.' };
      } catch (error) {
        return status(400, {
          error: error instanceof Error ? error.message : 'Password reset failed',
        });
      }
    },
    {
      body: ResetPasswordRequestSchema,
      detail: {
        tags: ['Auth'],
        summary: 'Verify OTP and reset password',
        description: 'Validate the 6-digit OTP and set a new password.',
      },
    },
  );
