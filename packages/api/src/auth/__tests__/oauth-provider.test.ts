/**
 * Unit tests for the @better-auth/oauth-provider plugin wiring.
 *
 * Coverage targets:
 *   - schema export: all seven OAuth tables exist on @packrat/db with the
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

import {
  oauthAccessToken,
  oauthClient,
  oauthClientResource,
  oauthConsent,
  oauthRefreshToken,
  oauthResource,
} from '@packrat/db/schema';
import { getTableConfig } from 'drizzle-orm/pg-core';
import { describe, expect, it } from 'vitest';

describe('OAuth provider schema (@packrat/db)', () => {
  // Regression guard for the 1.7 upgrade. The plugin resolves a resource by
  // its RFC 8707 identifier and writes that identifier straight into
  // oauthClientResource.resource_id — it never looks up the surrogate `id`.
  // Pointing this FK at oauthResource.id instead makes every dynamic client
  // registration fail with a 23503 foreign-key violation, which no amount of
  // type-checking catches because both columns are `text`.
  it('links oauthClientResource.resourceId to oauthResource.identifier, not id', () => {
    const resourceFk = getTableConfig(oauthClientResource)
      .foreignKeys.map((fk) => fk.reference())
      .find((ref) => ref.columns.some((col) => col.name === 'resource_id'));

    expect(resourceFk).toBeDefined();
    expect(resourceFk?.foreignColumns.map((col) => col.name)).toEqual(['identifier']);
    // Uniqueness on the target is what makes identifier a legal FK target.
    expect(oauthResource.identifier.isUnique).toBe(true);
  });

  it('exports the three tables 1.7 added', () => {
    expect(Object.keys(oauthResource)).toEqual(
      expect.arrayContaining(['identifier', 'name', 'allowedScopes', 'disabled']),
    );
    expect(Object.keys(oauthClientResource)).toEqual(
      expect.arrayContaining(['clientId', 'resourceId']),
    );
  });

  // 1.7 removed both columns: `type` became `applicationType`, and `public` has
  // no successor because public-vs-confidential is now derived solely from
  // tokenEndpointAuthMethod. Leaving either in the schema would make the
  // drizzle adapter write columns the migration has dropped.
  it('drops the 1.6 public/type columns and carries their 1.7 replacements', () => {
    const cols = Object.keys(oauthClient);
    expect(cols).not.toContain('public');
    expect(cols).not.toContain('type');
    expect(cols).toContain('applicationType');
    expect(cols).toContain('clientCredentialsScopes');
    expect(cols).toContain('clientDiscoveryId');
  });

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
