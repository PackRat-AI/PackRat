import { z } from 'zod';

export const LoginRequestSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
});

export const LoginResponseSchema = z.object({
  success: z.boolean(),
  accessToken: z.string(),
  refreshToken: z.string(),
  user: z.object({
    id: z.number(),
    email: z.string().email(),
    firstName: z.string().nullable(),
    lastName: z.string().nullable(),
    emailVerified: z.boolean().nullable(),
  }),
});

export const RegisterRequestSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  firstName: z.string().optional(),
  lastName: z.string().optional(),
});

export const RegisterResponseSchema = z.object({
  success: z.boolean(),
  message: z.string(),
  userId: z.number(),
});

export const VerifyEmailRequestSchema = z.object({
  email: z.string().email(),
  code: z.string().length(5),
});

export const VerifyEmailResponseSchema = z.object({
  success: z.boolean(),
  message: z.string(),
  accessToken: z.string(),
  refreshToken: z.string(),
  user: z.object({
    id: z.number(),
    email: z.string().email(),
    firstName: z.string().nullable(),
    lastName: z.string().nullable(),
    emailVerified: z.boolean().nullable(),
  }),
});

export const RefreshTokenRequestSchema = z.object({
  refreshToken: z.string(),
});

export const RefreshTokenResponseSchema = z.object({
  success: z.boolean(),
  accessToken: z.string(),
  refreshToken: z.string(),
  user: z.object({
    id: z.number(),
    email: z.string().email(),
    firstName: z.string().nullable(),
    lastName: z.string().nullable(),
    emailVerified: z.boolean().nullable(),
    role: z.string().nullable(),
  }),
});

export const ForgotPasswordRequestSchema = z.object({
  email: z.string().email(),
});

export const ForgotPasswordResponseSchema = z.object({
  success: z.boolean(),
  message: z.string(),
});

export const ResetPasswordRequestSchema = z.object({
  email: z.string().email(),
  code: z.string().length(5),
  newPassword: z.string().min(8),
});

export const ResetPasswordResponseSchema = z.object({
  success: z.boolean(),
  message: z.string(),
});

export const GoogleAuthRequestSchema = z.object({
  idToken: z.string(),
});

export const AppleAuthRequestSchema = z.object({
  identityToken: z.string(),
  authorizationCode: z.string(),
});

export const SocialAuthResponseSchema = z.object({
  success: z.boolean(),
  accessToken: z.string(),
  refreshToken: z.string(),
  user: z.object({
    id: z.number(),
    email: z.string().email(),
    firstName: z.string().nullable(),
    lastName: z.string().nullable(),
    emailVerified: z.boolean().nullable(),
    role: z.string().nullable(),
  }),
  isNewUser: z.boolean().optional(),
});

export const LogoutRequestSchema = z.object({
  refreshToken: z.string(),
});

export const LogoutResponseSchema = z.object({
  success: z.boolean(),
  message: z.string(),
});

export const MeResponseSchema = z.object({
  success: z.boolean(),
  user: z.object({
    id: z.number(),
    email: z.string().email(),
    firstName: z.string().nullable(),
    lastName: z.string().nullable(),
    emailVerified: z.boolean().nullable(),
  }),
});

export const ErrorResponseSchema = z.object({
  error: z.string(),
  code: z.string().optional(),
});
