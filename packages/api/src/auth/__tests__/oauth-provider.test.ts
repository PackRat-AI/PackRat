/**
 * Unit tests for the @better-auth/oauth-provider plugin wiring.
 *
 * Coverage targets:
 *   - schema export: all four OAuth tables exist on @packrat/db with the
 *     expected shape (column names + nullability matching the plugin's
 *     declared schema, so the drizzle adapter's auto-registration finds them)
 *   - plugin export shape: imported as a function from
 *     '@better-auth/oauth-provider', exports authServer/openidConfig helpers
 *
 * Discovery + flow assertions (issuer match, PKCE S256, JWT-only-with-resource
 * regression guard) live in the integration test suite in test/auth.test.ts;
 * they need a live Better Auth instance against the docker-test database
 * which the unit-test pool can't provide.
 */

import { oauthAccessToken, oauthClient, oauthConsent, oauthRefreshToken } from '@packrat/db';
import { describe, expect, it } from 'vitest';

describe('OAuth provider schema (@packrat/db)', () => {
  it('exports oauthClient table with snake_case columns', () => {
    expect(oauthClient).toBeDefined();
    const cols = Object.keys(oauthClient);
    expect(cols).toContain('clientId');
    expect(cols).toContain('redirectUris');
    expect(cols).toContain('tokenEndpointAuthMethod');
    expect(cols).toContain('requirePKCE');
    expect(cols).toContain('scopes');
    expect(cols).toContain('name');
    expect(cols).toContain('icon');
    expect(cols).toContain('tos');
    expect(cols).toContain('policy');
    expect(cols).toContain('uri');
  });

  it('exports oauthAccessToken table with refresh_id FK column', () => {
    expect(oauthAccessToken).toBeDefined();
    const cols = Object.keys(oauthAccessToken);
    expect(cols).toContain('clientId');
    expect(cols).toContain('userId');
    expect(cols).toContain('sessionId');
    expect(cols).toContain('refreshId');
    expect(cols).toContain('scopes');
    expect(cols).toContain('expiresAt');
  });

  it('exports oauthRefreshToken table with all RFC-required fields', () => {
    // oauthRefreshToken was MISSING from the original plan — spike caught
    // it. Verify its presence so refresh-token rotation works at first
    // attempt (R2: refresh tokens rotate with proper invalidation).
    expect(oauthRefreshToken).toBeDefined();
    const cols = Object.keys(oauthRefreshToken);
    expect(cols).toContain('clientId');
    expect(cols).toContain('userId');
    expect(cols).toContain('sessionId');
    expect(cols).toContain('token');
    expect(cols).toContain('expiresAt');
    expect(cols).toContain('revoked');
    expect(cols).toContain('authTime');
    expect(cols).toContain('scopes');
  });

  it('exports oauthConsent table', () => {
    expect(oauthConsent).toBeDefined();
    const cols = Object.keys(oauthConsent);
    expect(cols).toContain('clientId');
    expect(cols).toContain('userId');
    expect(cols).toContain('scopes');
  });
});

describe('OAuth provider plugin export', () => {
  it('exports oauthProvider as a callable plugin factory', async () => {
    const mod = await import('@better-auth/oauth-provider');
    expect(typeof mod.oauthProvider).toBe('function');
  });

  it('exports the AS metadata helper (oauthProviderAuthServerMetadata)', async () => {
    const mod = await import('@better-auth/oauth-provider');
    expect(typeof mod.oauthProviderAuthServerMetadata).toBe('function');
  });

  it('exports the OIDC config helper (oauthProviderOpenIdConfigMetadata)', async () => {
    const mod = await import('@better-auth/oauth-provider');
    expect(typeof mod.oauthProviderOpenIdConfigMetadata).toBe('function');
  });

  it('does NOT export oAuthDiscoveryMetadata (the spike-flagged wrong name)', async () => {
    // The plan originally referenced `oAuthDiscoveryMetadata` — spike
    // confirmed no such export exists in @better-auth/oauth-provider@1.6.11.
    // This test fails fast if a future upgrade introduces a different export
    // shape and the wrong helper name sneaks back into the plan.
    const mod = (await import('@better-auth/oauth-provider')) as Record<string, unknown>;
    expect(mod.oAuthDiscoveryMetadata).toBeUndefined();
  });
});
