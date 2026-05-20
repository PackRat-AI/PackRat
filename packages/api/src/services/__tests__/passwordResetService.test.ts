import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => {
  const deleteWhere = vi.fn().mockResolvedValue(undefined);
  const deleteFn = vi.fn(() => ({ where: deleteWhere }));

  const insertValues = vi.fn().mockResolvedValue(undefined);
  const insertFn = vi.fn(() => ({ values: insertValues }));

  const updateReturning = vi.fn().mockResolvedValue([]);
  const updateWhere = vi.fn(() => ({ returning: updateReturning }));
  const updateSet = vi.fn(() => ({ where: updateWhere }));
  const updateFn = vi.fn(() => ({ set: updateSet }));

  const findFirstUser = vi.fn();
  const findFirstVerification = vi.fn();

  return {
    deleteWhere,
    deleteFn,
    insertValues,
    insertFn,
    updateReturning,
    updateWhere,
    updateSet,
    updateFn,
    findFirstUser,
    findFirstVerification,
    createDb: vi.fn(() => ({
      query: {
        users: { findFirst: findFirstUser },
        verification: { findFirst: findFirstVerification },
      },
      delete: deleteFn,
      insert: insertFn,
      update: updateFn,
    })),
    sendPasswordResetEmail: vi.fn().mockResolvedValue(undefined),
    timingSafeEqual: vi.fn(({ a, b }: { a: string; b: string }) => a === b),
    hashPassword: vi.fn((p: string) => Promise.resolve(`hashed_${p}`)),
  };
});

vi.mock('@packrat/api/db', () => ({ createDb: mocks.createDb }));
vi.mock('@packrat/api/utils/email', () => ({
  sendPasswordResetEmail: mocks.sendPasswordResetEmail,
}));
vi.mock('@packrat/api/utils/auth', () => ({
  timingSafeEqual: mocks.timingSafeEqual,
}));
vi.mock('@better-auth/utils/password', () => ({
  hashPassword: mocks.hashPassword,
}));
vi.mock('@packrat/db', () => ({
  users: {},
  verification: {},
  account: {},
}));
vi.mock('drizzle-orm', () => ({
  and: vi.fn(),
  eq: vi.fn(),
  gt: vi.fn(),
}));

import { requestPasswordReset, verifyOtpAndResetPassword } from '../passwordResetService';

describe('requestPasswordReset()', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.deleteWhere.mockResolvedValue(undefined);
    mocks.insertValues.mockResolvedValue(undefined);
    mocks.sendPasswordResetEmail.mockResolvedValue(undefined);
  });

  it('does nothing for an unknown email address', async () => {
    mocks.findFirstUser.mockResolvedValue(undefined);
    await requestPasswordReset('unknown@example.com');
    expect(mocks.sendPasswordResetEmail).not.toHaveBeenCalled();
    expect(mocks.insertFn).not.toHaveBeenCalled();
  });

  it('deletes the existing verification record before inserting a new one', async () => {
    mocks.findFirstUser.mockResolvedValue({ id: 'u1', email: 'user@example.com' });
    await requestPasswordReset('user@example.com');
    expect(mocks.deleteFn).toHaveBeenCalled();
    expect(mocks.deleteWhere).toHaveBeenCalled();
    expect(mocks.insertValues).toHaveBeenCalled();
    expect(mocks.deleteWhere.mock.invocationCallOrder[0] ?? 0).toBeLessThan(
      mocks.insertValues.mock.invocationCallOrder[0] ?? Number.POSITIVE_INFINITY,
    );
  });

  it('inserts a new verification record for a known user', async () => {
    mocks.findFirstUser.mockResolvedValue({ id: 'u1', email: 'user@example.com' });
    await requestPasswordReset('user@example.com');
    expect(mocks.insertFn).toHaveBeenCalled();
    expect(mocks.insertValues).toHaveBeenCalledWith(
      expect.objectContaining({
        identifier: 'password-reset:user@example.com',
      }),
    );
  });

  it('sends the password reset email to the correct address', async () => {
    mocks.findFirstUser.mockResolvedValue({ id: 'u1', email: 'user@example.com' });
    await requestPasswordReset('user@example.com');
    expect(mocks.sendPasswordResetEmail).toHaveBeenCalledWith(
      expect.objectContaining({ to: 'user@example.com' }),
    );
  });

  it('sends a 6-digit OTP in the email', async () => {
    mocks.findFirstUser.mockResolvedValue({ id: 'u1', email: 'user@example.com' });
    await requestPasswordReset('user@example.com');
    const emailCalls = mocks.sendPasswordResetEmail.mock.calls as Array<
      [{ to: string; code: string }]
    >;
    const emailArg = emailCalls[0]?.[0];
    expect(emailArg?.code).toMatch(/^\d{6}$/);
  });

  it('stores the OTP value in the verification record', async () => {
    mocks.findFirstUser.mockResolvedValue({ id: 'u1', email: 'user@example.com' });
    await requestPasswordReset('user@example.com');
    const insertCalls = mocks.insertValues.mock.calls as Array<[{ value: string }]>;
    const insertArg = insertCalls[0]?.[0];
    expect(insertArg?.value).toMatch(/^\d{6}$/);
  });

  it('stores the same OTP in both the record and the email', async () => {
    mocks.findFirstUser.mockResolvedValue({ id: 'u1', email: 'user@example.com' });
    await requestPasswordReset('user@example.com');
    const insertCalls = mocks.insertValues.mock.calls as Array<[{ value: string }]>;
    const emailCalls = mocks.sendPasswordResetEmail.mock.calls as Array<[{ code: string }]>;
    const insertedCode = insertCalls[0]?.[0]?.value;
    const emailedCode = emailCalls[0]?.[0]?.code;
    expect(insertedCode).toBe(emailedCode);
  });

  it('sets an expiry date in the future on the verification record', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-01-01T00:00:00.000Z'));
    mocks.findFirstUser.mockResolvedValue({ id: 'u1', email: 'user@example.com' });
    try {
      const before = Date.now();
      await requestPasswordReset('user@example.com');
      const insertCalls = mocks.insertValues.mock.calls as Array<
        [{ value: string; expiresAt: Date }]
      >;
      const insertArg = insertCalls[0]?.[0];
      expect(insertArg?.expiresAt.getTime()).toBeGreaterThan(before);
    } finally {
      vi.useRealTimers();
    }
  });
});

describe('verifyOtpAndResetPassword()', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.deleteWhere.mockResolvedValue(undefined);
    mocks.updateReturning.mockResolvedValue([]);
  });

  it('throws for a missing or expired verification record', async () => {
    mocks.findFirstVerification.mockResolvedValue(null);
    await expect(
      verifyOtpAndResetPassword({ email: 'user@example.com', code: '123456', newPassword: 'new' }),
    ).rejects.toThrow('Invalid or expired reset code');
  });

  it('throws when the OTP does not match', async () => {
    mocks.findFirstVerification.mockResolvedValue({ value: '999999' });
    // timingSafeEqual is mocked as strict equality; '999999' !== '123456'  (object arg)
    await expect(
      verifyOtpAndResetPassword({ email: 'user@example.com', code: '123456', newPassword: 'new' }),
    ).rejects.toThrow('Invalid or expired reset code');
  });

  it('throws when the user cannot be found after OTP passes', async () => {
    mocks.findFirstVerification.mockResolvedValue({ value: '123456' });
    mocks.findFirstUser.mockResolvedValue(null);
    await expect(
      verifyOtpAndResetPassword({ email: 'user@example.com', code: '123456', newPassword: 'new' }),
    ).rejects.toThrow('User not found');
  });

  it('hashes the new password before persisting it', async () => {
    mocks.findFirstVerification.mockResolvedValue({ value: '123456' });
    mocks.findFirstUser.mockResolvedValue({ id: 'u1', email: 'user@example.com' });
    mocks.updateReturning.mockResolvedValue([{ id: 'account-1' }]);

    await verifyOtpAndResetPassword({
      email: 'user@example.com',
      code: '123456',
      newPassword: 'plaintext',
    });
    expect(mocks.hashPassword).toHaveBeenCalledWith('plaintext');
  });

  it('updates the account table with the hashed password on success', async () => {
    mocks.findFirstVerification.mockResolvedValue({ value: '123456' });
    mocks.findFirstUser.mockResolvedValue({ id: 'u1', email: 'user@example.com' });
    mocks.updateReturning.mockResolvedValue([{ id: 'account-1' }]);

    await verifyOtpAndResetPassword({
      email: 'user@example.com',
      code: '123456',
      newPassword: 'newpass',
    });
    expect(mocks.updateFn).toHaveBeenCalled();
    expect(mocks.updateSet).toHaveBeenCalledWith(
      expect.objectContaining({ password: 'hashed_newpass' }),
    );
  });

  it('deletes the verification record after a successful reset', async () => {
    mocks.findFirstVerification.mockResolvedValue({ value: '123456' });
    mocks.findFirstUser.mockResolvedValue({ id: 'u1', email: 'user@example.com' });
    mocks.updateReturning.mockResolvedValue([{ id: 'account-1' }]);

    await verifyOtpAndResetPassword({
      email: 'user@example.com',
      code: '123456',
      newPassword: 'newpass',
    });
    expect(mocks.deleteFn).toHaveBeenCalled();
    expect(mocks.deleteWhere).toHaveBeenCalled();
  });

  it('falls back to updating the users table when no account record is found', async () => {
    mocks.findFirstVerification.mockResolvedValue({ value: '123456' });
    mocks.findFirstUser.mockResolvedValue({ id: 'u1', email: 'user@example.com' });

    // First update call (account table) returns empty — triggers fallback
    mocks.updateReturning.mockResolvedValueOnce([]);

    // Second update call (users table) — where() is awaited directly, no .returning()
    const usersUpdateWhere = vi.fn().mockResolvedValue(undefined);
    const usersUpdateSet = vi.fn(() => ({ where: usersUpdateWhere }));
    mocks.updateFn
      .mockReturnValueOnce({ set: mocks.updateSet })
      .mockReturnValueOnce({ set: usersUpdateSet });

    await verifyOtpAndResetPassword({
      email: 'user@example.com',
      code: '123456',
      newPassword: 'newpass',
    });
    expect(mocks.updateFn).toHaveBeenCalledTimes(2);
    expect(usersUpdateSet).toHaveBeenCalledWith(
      expect.objectContaining({ passwordHash: 'hashed_newpass' }),
    );
  });
});
