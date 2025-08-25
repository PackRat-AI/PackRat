import { z } from '@hono/zod-openapi';

export const LoginRequestSchema = z
  .object({
    email: z.string().email().openapi({
      example: 'user@example.com',
      description: 'User email address',
    }),
    password: z.string().min(8).openapi({
      example: 'SecurePassword123!',
      description: 'User password (minimum 8 characters)',
    }),
  })
  .openapi('LoginRequest');

export const LoginResponseSchema = z
  .object({
    success: z.boolean().openapi({ example: true }),
    accessToken: z.string().openapi({
      example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
      description: 'JWT access token',
    }),
    refreshToken: z.string().openapi({
      example: 'rf_1234567890abcdef',
      description: 'Refresh token for obtaining new access tokens',
    }),
    user: z.object({
      id: z.number().openapi({ example: 1 }),
      email: z.string().email().openapi({ example: 'user@example.com' }),
      firstName: z.string().nullable().openapi({ example: 'John' }),
      lastName: z.string().nullable().openapi({ example: 'Doe' }),
      emailVerified: z.boolean().nullable().openapi({ example: true }),
    }),
  })
  .openapi('LoginResponse');

export const RegisterRequestSchema = z
  .object({
    email: z.string().email().openapi({
      example: 'newuser@example.com',
      description: 'Email address for the new account',
    }),
    password: z.string().min(8).openapi({
      example: 'SecurePassword123!',
      description: 'Password must be at least 8 characters',
    }),
    firstName: z.string().optional().openapi({
      example: 'Jane',
      description: 'User first name',
    }),
    lastName: z.string().optional().openapi({
      example: 'Smith',
      description: 'User last name',
    }),
  })
  .openapi('RegisterRequest');

export const RegisterResponseSchema = z
  .object({
    success: z.boolean().openapi({ example: true }),
    message: z.string().openapi({
      example: 'User registered successfully. Please check your email for your verification code.',
    }),
    userId: z.number().openapi({ example: 123 }),
  })
  .openapi('RegisterResponse');

export const VerifyEmailRequestSchema = z
  .object({
    email: z.string().email().openapi({
      example: 'user@example.com',
      description: 'Email address to verify',
    }),
    code: z.string().length(5).openapi({
      example: 'A1B2C',
      description: '5-character verification code sent to email',
    }),
  })
  .openapi('VerifyEmailRequest');

export const VerifyEmailResponseSchema = z
  .object({
    success: z.boolean().openapi({ example: true }),
    message: z.string().openapi({ example: 'Email verified successfully' }),
    accessToken: z.string().openapi({
      example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
      description: 'JWT access token',
    }),
    refreshToken: z.string().openapi({
      example: 'rf_1234567890abcdef',
      description: 'Refresh token',
    }),
    user: z.object({
      id: z.number().openapi({ example: 1 }),
      email: z.string().email().openapi({ example: 'user@example.com' }),
      firstName: z.string().nullable().openapi({ example: 'John' }),
      lastName: z.string().nullable().openapi({ example: 'Doe' }),
      emailVerified: z.boolean().nullable().openapi({ example: true }),
    }),
  })
  .openapi('VerifyEmailResponse');

export const RefreshTokenRequestSchema = z
  .object({
    refreshToken: z.string().openapi({
      example: 'rf_1234567890abcdef',
      description: 'Valid refresh token',
    }),
  })
  .openapi('RefreshTokenRequest');

export const RefreshTokenResponseSchema = z
  .object({
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
  })
  .openapi('RefreshTokenResponse');

export const ForgotPasswordRequestSchema = z
  .object({
    email: z.string().email().openapi({
      example: 'user@example.com',
      description: 'Email address associated with the account',
    }),
  })
  .openapi('ForgotPasswordRequest');

export const ForgotPasswordResponseSchema = z
  .object({
    success: z.boolean(),
    message: z.string().openapi({
      example: 'If your email is registered, you will receive a verification code',
    }),
  })
  .openapi('ForgotPasswordResponse');

export const ResetPasswordRequestSchema = z
  .object({
    email: z.string().email(),
    code: z.string().length(5).openapi({
      description: 'Verification code sent to email',
    }),
    newPassword: z.string().min(8).openapi({
      description: 'New password (minimum 8 characters)',
    }),
  })
  .openapi('ResetPasswordRequest');

export const ResetPasswordResponseSchema = z
  .object({
    success: z.boolean(),
    message: z.string().openapi({
      example: 'Password reset successfully',
    }),
  })
  .openapi('ResetPasswordResponse');

export const GoogleAuthRequestSchema = z
  .object({
    idToken: z.string().openapi({
      description: 'Google ID token obtained from Google Sign-In',
    }),
  })
  .openapi('GoogleAuthRequest');

export const AppleAuthRequestSchema = z
  .object({
    identityToken: z.string().openapi({
      description: 'Apple identity token from Sign in with Apple',
    }),
    authorizationCode: z.string().openapi({
      description: 'Apple authorization code',
    }),
  })
  .openapi('AppleAuthRequest');

export const SocialAuthResponseSchema = z
  .object({
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
    }).optional(),
    isNewUser: z.boolean().optional().openapi({
      description: 'Indicates if this is a newly created account',
    }),
  })
  .openapi('SocialAuthResponse');

export const LogoutRequestSchema = z
  .object({
    refreshToken: z.string().openapi({
      description: 'Refresh token to revoke',
    }),
  })
  .openapi('LogoutRequest');

export const LogoutResponseSchema = z
  .object({
    success: z.boolean(),
    message: z.string(),
  })
  .openapi('LogoutResponse');

export const MeResponseSchema = z
  .object({
    success: z.boolean(),
    user: z.object({
      id: z.number().openapi({ example: 1 }),
      email: z.string().email().openapi({ example: 'user@example.com' }),
      firstName: z.string().nullable().openapi({ example: 'John' }),
      lastName: z.string().nullable().openapi({ example: 'Doe' }),
      emailVerified: z.boolean().nullable().openapi({ example: true }),
    }),
  })
  .openapi('MeResponse');

export const ErrorResponseSchema = z
  .object({
    error: z.string().openapi({
      description: 'Error message',
    }),
    code: z.string().optional().openapi({
      description: 'Error code for programmatic handling',
    }),
  })
  .openapi('ErrorResponse');
