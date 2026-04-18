import { z } from '@hono/zod-openapi';

// ── Supported values ──────────────────────────────────────────────────────────

export const DEVICE_CODE_GRANT_TYPE = 'urn:ietf:params:oauth:grant-type:device_code' as const;

export const SUPPORTED_SCOPES = [
  'read:packs',
  'write:packs',
  'read:trips',
  'write:trips',
  'read:catalog',
  'read:profile',
  'write:profile',
  '*',
] as const;

export type OAuthScope = (typeof SUPPORTED_SCOPES)[number];

// ── Token TTLs ────────────────────────────────────────────────────────────────

/** Authorization code valid for 10 minutes. */
export const AUTH_CODE_TTL_MS = 10 * 60 * 1000;

/** OAuth access token valid for 90 days (long-lived for CLI / MCP use). */
export const ACCESS_TOKEN_TTL_MS = 90 * 24 * 60 * 60 * 1000;

/** Device code valid for 15 minutes. */
export const DEVICE_CODE_TTL_MS = 15 * 60 * 1000;

/** Polling interval in seconds. */
export const DEVICE_POLL_INTERVAL = 5;

// ── Request schemas ───────────────────────────────────────────────────────────

export const AuthorizationRequestSchema = z
  .object({
    client_id: z.string().min(1).openapi({ description: 'OAuth client identifier' }),
    redirect_uri: z.string().url().openapi({ description: 'Redirect URI after authorization' }),
    response_type: z.literal('code').openapi({ description: 'Must be "code"' }),
    scope: z.string().default('*').openapi({ description: 'Requested scopes (space-separated)' }),
    state: z.string().optional().openapi({ description: 'Opaque value for CSRF protection' }),
    code_challenge: z.string().min(43).max(128).openapi({ description: 'PKCE code challenge' }),
    code_challenge_method: z
      .literal('S256')
      .openapi({ description: 'PKCE method — only S256 supported' }),
  })
  .openapi('AuthorizationRequest');

export const TokenRequestSchema = z
  .object({
    grant_type: z
      .string()
      .openapi({ description: 'OAuth grant type', example: 'authorization_code' }),
    // authorization_code fields
    code: z.string().optional().openapi({ description: 'Authorization code' }),
    redirect_uri: z.string().optional().openapi({ description: 'Must match authorize redirect_uri' }),
    code_verifier: z.string().optional().openapi({ description: 'PKCE code verifier' }),
    // device_code fields
    device_code: z.string().optional().openapi({ description: 'Device authorization code' }),
    // common
    client_id: z.string().min(1).openapi({ description: 'OAuth client identifier' }),
    client_secret: z.string().optional().openapi({ description: 'Client secret (confidential clients)' }),
  })
  .openapi('TokenRequest');

export const DeviceCodeRequestSchema = z
  .object({
    client_id: z.string().min(1).openapi({ description: 'OAuth client identifier' }),
    scope: z.string().default('*').openapi({ description: 'Requested scopes' }),
  })
  .openapi('DeviceCodeRequest');

export const IntrospectRequestSchema = z
  .object({
    token: z.string().openapi({ description: 'Token to introspect' }),
    token_type_hint: z
      .enum(['access_token'])
      .optional()
      .openapi({ description: 'Type hint for the token' }),
  })
  .openapi('IntrospectRequest');

export const RevokeRequestSchema = z
  .object({
    token: z.string().openapi({ description: 'Token to revoke' }),
    token_type_hint: z
      .enum(['access_token'])
      .optional()
      .openapi({ description: 'Type hint for the token' }),
    client_id: z.string().min(1).openapi({ description: 'OAuth client identifier' }),
  })
  .openapi('RevokeRequest');

// ── Response schemas ──────────────────────────────────────────────────────────

export const TokenResponseSchema = z
  .object({
    access_token: z.string().openapi({ description: 'OAuth access token' }),
    token_type: z.literal('Bearer').openapi({ description: 'Token type' }),
    expires_in: z.number().openapi({ description: 'Seconds until the token expires' }),
    scope: z.string().openapi({ description: 'Granted scopes' }),
  })
  .openapi('TokenResponse');

export const DeviceCodeResponseSchema = z
  .object({
    device_code: z.string().openapi({ description: 'Device authorization code (opaque)' }),
    user_code: z
      .string()
      .openapi({ description: 'Human-readable code to enter at verification_uri' }),
    verification_uri: z
      .string()
      .url()
      .openapi({ description: 'URL where the user enters the user_code' }),
    verification_uri_complete: z
      .string()
      .url()
      .optional()
      .openapi({ description: 'Convenience URL with user_code pre-filled' }),
    expires_in: z.number().openapi({ description: 'Seconds until device_code expires' }),
    interval: z.number().openapi({ description: 'Minimum polling interval in seconds' }),
  })
  .openapi('DeviceCodeResponse');

export const IntrospectResponseSchema = z
  .object({
    active: z.boolean().openapi({ description: 'Whether the token is active' }),
    scope: z.string().optional().openapi({ description: 'Token scopes' }),
    client_id: z.string().optional().openapi({ description: 'Client the token was issued to' }),
    sub: z.string().optional().openapi({ description: 'User ID the token belongs to' }),
    exp: z.number().optional().openapi({ description: 'Expiry timestamp (Unix seconds)' }),
    iat: z.number().optional().openapi({ description: 'Issued-at timestamp (Unix seconds)' }),
  })
  .openapi('IntrospectResponse');

export const OAuthErrorSchema = z
  .object({
    error: z
      .string()
      .openapi({ description: 'OAuth error code', example: 'invalid_client' }),
    error_description: z
      .string()
      .optional()
      .openapi({ description: 'Human-readable error description' }),
  })
  .openapi('OAuthError');
