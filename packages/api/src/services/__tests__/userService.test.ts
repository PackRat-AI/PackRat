import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => {
  const limitFn = vi.fn();
  const whereFn = vi.fn(() => ({ limit: limitFn }));
  const fromFn = vi.fn(() => ({ where: whereFn }));
  const selectFn = vi.fn(() => ({ from: fromFn }));

  const returningFn = vi.fn();
  const valuesFn = vi.fn(() => ({ returning: returningFn }));
  const insertFn = vi.fn(() => ({ values: valuesFn }));

  return {
    limitFn,
    whereFn,
    fromFn,
    selectFn,
    returningFn,
    valuesFn,
    insertFn,
    createDb: vi.fn(() => ({ select: selectFn, insert: insertFn })),
    hashPassword: vi.fn((p: string) => Promise.resolve(`hashed_${p}`)),
  };
});

vi.mock('@packrat/api/db', () => ({ createDb: mocks.createDb }));
vi.mock('@packrat/api/utils/auth', () => ({ hashPassword: mocks.hashPassword }));
vi.mock('@packrat/db', () => ({ users: { email: 'email', id: 'id' } }));
vi.mock('drizzle-orm', () => ({ eq: vi.fn() }));

import { UserService } from '../userService';

describe('UserService', () => {
  let service: UserService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new UserService();
  });

  describe('findByEmail()', () => {
    it('returns the user when found', async () => {
      const fakeUser = { id: 'u1', email: 'alice@example.com' };
      mocks.limitFn.mockResolvedValue([fakeUser]);

      const result = await service.findByEmail('alice@example.com');
      expect(result).toEqual(fakeUser);
    });

    it('returns null when no user is found', async () => {
      mocks.limitFn.mockResolvedValue([]);
      const result = await service.findByEmail('nobody@example.com');
      expect(result).toBeNull();
    });

    it('uses select().from().where().limit(1) query chain', async () => {
      mocks.limitFn.mockResolvedValue([]);
      await service.findByEmail('test@example.com');
      expect(mocks.selectFn).toHaveBeenCalled();
      expect(mocks.fromFn).toHaveBeenCalled();
      expect(mocks.whereFn).toHaveBeenCalled();
      expect(mocks.limitFn).toHaveBeenCalledWith(1);
    });

    it('lowercases the email before querying', async () => {
      mocks.limitFn.mockResolvedValue([]);
      await service.findByEmail('ALICE@EXAMPLE.COM');
      // UserService calls eq(users.email, email.toLowerCase()), which is called with the lowercased value
      const { eq } = await import('drizzle-orm');
      const { users } = await import('@packrat/db');
      expect(vi.mocked(eq)).toHaveBeenCalledWith(users.email, 'alice@example.com');
    });
  });

  describe('create()', () => {
    it('creates a user and returns it', async () => {
      const fakeUser = { id: 'u2', email: 'bob@example.com', role: 'USER' };
      mocks.returningFn.mockResolvedValue([fakeUser]);

      const result = await service.create({ email: 'Bob@Example.com', password: 'secret' });
      expect(result).toEqual(fakeUser);
    });

    it('lowercases the email before inserting', async () => {
      mocks.returningFn.mockResolvedValue([{ id: 'u3', email: 'charlie@example.com' }]);
      await service.create({ email: 'CHARLIE@EXAMPLE.COM' });
      expect(mocks.valuesFn).toHaveBeenCalledWith(
        expect.objectContaining({ email: 'charlie@example.com' }),
      );
    });

    it('hashes the password when provided', async () => {
      mocks.returningFn.mockResolvedValue([{ id: 'u4', email: 'test@example.com' }]);
      await service.create({ email: 'test@example.com', password: 'mypassword' });
      expect(mocks.hashPassword).toHaveBeenCalledWith('mypassword');
      expect(mocks.valuesFn).toHaveBeenCalledWith(
        expect.objectContaining({ passwordHash: 'hashed_mypassword' }),
      );
    });

    it('sets passwordHash to null when no password is provided', async () => {
      mocks.returningFn.mockResolvedValue([{ id: 'u5', email: 'test@example.com' }]);
      await service.create({ email: 'test@example.com' });
      expect(mocks.valuesFn).toHaveBeenCalledWith(expect.objectContaining({ passwordHash: null }));
    });

    it('defaults role to USER when not specified', async () => {
      mocks.returningFn.mockResolvedValue([{ id: 'u6', email: 'test@example.com', role: 'USER' }]);
      await service.create({ email: 'test@example.com' });
      expect(mocks.valuesFn).toHaveBeenCalledWith(expect.objectContaining({ role: 'USER' }));
    });

    it('accepts an explicit ADMIN role', async () => {
      mocks.returningFn.mockResolvedValue([
        { id: 'u7', email: 'admin@example.com', role: 'ADMIN' },
      ]);
      await service.create({ email: 'admin@example.com', role: 'ADMIN' });
      expect(mocks.valuesFn).toHaveBeenCalledWith(expect.objectContaining({ role: 'ADMIN' }));
    });

    it('defaults emailVerified to false', async () => {
      mocks.returningFn.mockResolvedValue([{ id: 'u8', email: 'test@example.com' }]);
      await service.create({ email: 'test@example.com' });
      expect(mocks.valuesFn).toHaveBeenCalledWith(
        expect.objectContaining({ emailVerified: false }),
      );
    });

    it('accepts an explicit emailVerified: true', async () => {
      mocks.returningFn.mockResolvedValue([{ id: 'u9', email: 'test@example.com' }]);
      await service.create({ email: 'test@example.com', emailVerified: true });
      expect(mocks.valuesFn).toHaveBeenCalledWith(expect.objectContaining({ emailVerified: true }));
    });

    it('throws "Failed to create user" when insert returns no rows', async () => {
      mocks.returningFn.mockResolvedValue([]);
      await expect(service.create({ email: 'fail@example.com' })).rejects.toThrow(
        'Failed to create user',
      );
    });

    it('generates a UUID for the user id', async () => {
      mocks.returningFn.mockResolvedValue([{ id: 'u10', email: 'test@example.com' }]);
      await service.create({ email: 'test@example.com' });
      const insertCalls = mocks.valuesFn.mock.calls as unknown as Array<[{ id: string }]>;
      const insertArg = insertCalls[0]?.[0];
      expect(insertArg?.id).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/,
      );
    });
  });
});
