import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  generateAuthCode,
  generateDeviceCode,
  generateOAuthToken,
  generateUserCode,
  verifyPKCEChallenge,
} from '../oauthService';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

vi.mock('node:crypto', () => ({
  randomBytes: vi.fn((length: number) => ({
    toString: (_encoding: string) => 'a'.repeat(length * 2),
    [Symbol.iterator]: function* () {
      for (let i = 0; i < length; i++) yield 0;
    },
  })),
}));

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('oauthService — token/code generators', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('generateOAuthToken', () => {
    it('returns a string starting with "oa_"', () => {
      const token = generateOAuthToken();
      expect(token).toMatch(/^oa_/);
    });

    it('has the expected length (oa_ + 64 hex chars from 32 bytes)', () => {
      const token = generateOAuthToken();
      // randomBytes(32).toString('hex') = 64 chars; + 'oa_' = 67 total
      expect(token).toHaveLength(67);
    });
  });

  describe('generateDeviceCode', () => {
    it('returns a 64-char hex string', () => {
      const code = generateDeviceCode();
      expect(code).toHaveLength(64);
      expect(code).toMatch(/^[0-9a-f]+$/);
    });
  });

  describe('generateAuthCode', () => {
    it('returns a 40-char hex string', () => {
      const code = generateAuthCode();
      expect(code).toHaveLength(40);
      expect(code).toMatch(/^[0-9a-f]+$/);
    });
  });

  describe('generateUserCode', () => {
    it('returns a string matching XXXX-XXXX pattern', () => {
      // With mocked randomBytes yielding 0s, all chars map to 'A' (index 0 of CHARS)
      const code = generateUserCode();
      expect(code).toMatch(/^[A-Z2-9]{4}-[A-Z2-9]{4}$/);
    });

    it('has exactly 9 characters (4 + hyphen + 4)', () => {
      const code = generateUserCode();
      expect(code).toHaveLength(9);
    });

    it('contains a hyphen as the 5th character', () => {
      const code = generateUserCode();
      expect(code[4]).toBe('-');
    });
  });
});

describe('oauthService — PKCE S256 verification', () => {
  it('accepts a valid code_verifier + code_challenge pair', async () => {
    // Pre-computed: SHA-256('dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk') = ...
    // Using a known test vector from the RFC 7636 appendix:
    // verifier = 'dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk'
    // challenge = 'E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM'
    const verifier = 'dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk';
    const challenge = 'E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM';
    const result = await verifyPKCEChallenge(verifier, challenge);
    expect(result).toBe(true);
  });

  it('rejects a mismatched code_verifier', async () => {
    const verifier = 'wrong-verifier-value-that-does-not-match-challenge';
    const challenge = 'E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM';
    const result = await verifyPKCEChallenge(verifier, challenge);
    expect(result).toBe(false);
  });

  it('rejects an empty verifier', async () => {
    const result = await verifyPKCEChallenge('', 'some-challenge');
    expect(result).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// DB-backed operations (mocked DB)
// ---------------------------------------------------------------------------

describe('oauthService — DB operations', () => {
  const makeDb = () => ({
    select: vi.fn().mockReturnThis(),
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    limit: vi.fn().mockResolvedValue([]),
    insert: vi.fn().mockReturnThis(),
    values: vi.fn().mockResolvedValue({}),
    update: vi.fn().mockReturnThis(),
    set: vi.fn().mockReturnThis(),
    delete: vi.fn().mockReturnThis(),
    innerJoin: vi.fn().mockReturnThis(),
  });

  describe('findClient', () => {
    it('returns null when no client is found', async () => {
      const { findClient } = await import('../oauthService');
      const db = makeDb();
      db.limit.mockResolvedValueOnce([]);
      const result = await findClient(db as any, 'unknown-client');
      expect(result).toBeNull();
    });

    it('returns a ClientRecord when the client exists', async () => {
      const { findClient } = await import('../oauthService');
      const db = makeDb();
      db.limit.mockResolvedValueOnce([
        {
          id: 'packrat-cli',
          name: 'PackRat CLI',
          secret: null,
          redirectUris: [],
          grants: ['urn:ietf:params:oauth:grant-type:device_code'],
          scopes: ['*'],
          isPublic: true,
        },
      ]);
      const result = await findClient(db as any, 'packrat-cli');
      expect(result).not.toBeNull();
      expect(result?.id).toBe('packrat-cli');
      expect(result?.name).toBe('PackRat CLI');
      expect(result?.isPublic).toBe(true);
    });
  });

  describe('createAccessToken', () => {
    it('calls db.insert with correct values and returns a token', async () => {
      const { createAccessToken } = await import('../oauthService');
      const db = makeDb();
      const result = await createAccessToken(db as any, {
        clientId: 'packrat-cli',
        userId: 1,
        scope: '*',
      });
      expect(result.token).toMatch(/^oa_/);
      expect(result.expiresIn).toBeGreaterThan(0);
      expect(db.insert).toHaveBeenCalled();
    });
  });

  describe('validateAccessToken', () => {
    it('returns null when token is not found', async () => {
      const { validateAccessToken } = await import('../oauthService');
      const db = makeDb();
      db.limit.mockResolvedValueOnce([]);
      const result = await validateAccessToken(db as any, 'oa_nonexistent');
      expect(result).toBeNull();
    });

    it('returns ValidatedToken when a valid token is found', async () => {
      const { validateAccessToken } = await import('../oauthService');
      const db = makeDb();
      db.limit.mockResolvedValueOnce([
        {
          userId: 42,
          scope: 'read:packs',
          clientId: 'packrat-cli',
          expiresAt: new Date(Date.now() + 60_000),
          revokedAt: null,
          role: 'USER',
        },
      ]);
      const result = await validateAccessToken(db as any, 'oa_valid_token');
      expect(result).toEqual({
        userId: 42,
        role: 'USER',
        scope: 'read:packs',
        clientId: 'packrat-cli',
      });
    });
  });

  describe('createDeviceCode', () => {
    it('returns device code, user code, expiresIn, and interval', async () => {
      const { createDeviceCode } = await import('../oauthService');
      const db = makeDb();
      const result = await createDeviceCode(db as any, {
        clientId: 'packrat-cli',
        scope: '*',
      });
      expect(result.deviceCode).toBeTruthy();
      expect(result.userCode).toMatch(/^[A-Z2-9]{4}-[A-Z2-9]{4}$/);
      expect(result.expiresIn).toBeGreaterThan(0);
      expect(result.interval).toBe(5);
    });
  });

  describe('pollDeviceCode', () => {
    it('returns expired when no row is found', async () => {
      const { pollDeviceCode } = await import('../oauthService');
      const db = makeDb();
      db.limit.mockResolvedValueOnce([]);
      const result = await pollDeviceCode(db as any, {
        deviceCode: 'unknown',
        clientId: 'packrat-cli',
      });
      expect(result.status).toBe('expired');
    });

    it('returns pending when verifiedAt is null', async () => {
      const { pollDeviceCode } = await import('../oauthService');
      const db = makeDb();
      db.limit.mockResolvedValueOnce([
        {
          id: 1,
          deviceCode: 'test-device-code',
          userCode: 'ABCD-1234',
          clientId: 'packrat-cli',
          scope: '*',
          userId: null,
          expiresAt: new Date(Date.now() + 60_000),
          verifiedAt: null,
          interval: 5,
        },
      ]);
      const result = await pollDeviceCode(db as any, {
        deviceCode: 'test-device-code',
        clientId: 'packrat-cli',
      });
      expect(result.status).toBe('pending');
    });

    it('returns expired when device code has passed expiry', async () => {
      const { pollDeviceCode } = await import('../oauthService');
      const db = makeDb();
      db.limit.mockResolvedValueOnce([
        {
          id: 1,
          deviceCode: 'test-device-code',
          userCode: 'ABCD-1234',
          clientId: 'packrat-cli',
          scope: '*',
          userId: 1,
          expiresAt: new Date(Date.now() - 1000), // already expired
          verifiedAt: new Date(),
          interval: 5,
        },
      ]);
      const result = await pollDeviceCode(db as any, {
        deviceCode: 'test-device-code',
        clientId: 'packrat-cli',
      });
      expect(result.status).toBe('expired');
    });
  });

  describe('introspectToken', () => {
    it('returns { active: false } when token is not found', async () => {
      const { introspectToken } = await import('../oauthService');
      const db = makeDb();
      db.limit.mockResolvedValueOnce([]);
      const result = await introspectToken(db as any, 'oa_unknown');
      expect(result).toEqual({ active: false });
    });

    it('returns active token info when token is valid', async () => {
      const { introspectToken } = await import('../oauthService');
      const db = makeDb();
      const now = new Date();
      db.limit.mockResolvedValueOnce([
        {
          token: 'oa_test',
          clientId: 'packrat-cli',
          userId: 1,
          scope: 'read:packs',
          expiresAt: new Date(Date.now() + 60_000),
          revokedAt: null,
          createdAt: now,
        },
      ]);
      const result = await introspectToken(db as any, 'oa_test');
      expect(result.active).toBe(true);
      expect(result.scope).toBe('read:packs');
      expect(result.clientId).toBe('packrat-cli');
    });
  });
});
