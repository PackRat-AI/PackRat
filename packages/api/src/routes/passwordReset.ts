import {
  requestPasswordReset,
  verifyOtpAndResetPassword,
} from '@packrat/api/services/passwordResetService';
import { ForgotPasswordRequestSchema, ResetPasswordRequestSchema } from '@packrat/schemas/auth';
import { Elysia, status } from 'elysia';

export const passwordResetRoutes = new Elysia({ prefix: '/password-reset' })
  .model({
    'passwordReset.ForgotPasswordRequest': ForgotPasswordRequestSchema,
    'passwordReset.ResetPasswordRequest': ResetPasswordRequestSchema,
  })
  // public-route: unauthenticated users need this to initiate a password reset
  .post(
    '/request',
    async ({ body }) => {
      await requestPasswordReset(body.email);
      return { success: true, message: 'If an account exists, a reset code has been sent.' };
    },
    {
      body: 'passwordReset.ForgotPasswordRequest',
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
      body: 'passwordReset.ResetPasswordRequest',
      detail: {
        tags: ['Auth'],
        summary: 'Verify OTP and reset password',
        description: 'Validate the 6-digit OTP and set a new password.',
      },
    },
  );
