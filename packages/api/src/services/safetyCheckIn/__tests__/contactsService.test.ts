import { beforeEach, describe, expect, it, vi } from 'vitest';

// Every query is `db.tag(label)...`; the chain resolves to the next queued
// result for that label, and records each builder call for assertions.
const mocks = vi.hoisted(() => {
  const results = new Map<string, unknown[]>();
  const calls: { label: string; method: string; args: unknown[] }[] = [];
  const next = (label: string) => {
    const queue = results.get(label) ?? [];
    return Promise.resolve(queue.length > 1 ? queue.shift() : (queue[0] ?? []));
  };
  const chain = (label: string): unknown =>
    new Proxy(
      {},
      {
        get(_target, prop) {
          if (prop === 'then') {
            const promise = next(label);
            return promise.then.bind(promise);
          }
          return (...args: unknown[]) => {
            calls.push({ label, method: String(prop), args });
            return chain(label);
          };
        },
      },
    );
  return {
    results,
    calls,
    createDb: vi.fn(() => ({ tag: (label: string) => chain(label) })),
  };
});

vi.mock('@packrat/api/db', () => ({ createDb: mocks.createDb }));

import {
  ContactValidationError,
  createEmergencyContact,
  deleteEmergencyContact,
  listEmergencyContacts,
  toEmergencyContactResponse,
  updateEmergencyContact,
} from '../contactsService';

const when = (label: string, ...values: unknown[]) => mocks.results.set(label, values);
const callsFor = (label: string, method: string) =>
  mocks.calls.filter((c) => c.label === label && c.method === method).map((c) => c.args[0]);

const created = new Date('2026-10-01T00:00:00.000Z');
const row = (overrides: Record<string, unknown> = {}) => ({
  id: 'c1',
  userId: 'u1',
  name: 'Mom',
  phone: '+15005550006',
  email: null,
  isDefault: true,
  introducedAt: null,
  deleted: false,
  createdAt: created,
  updatedAt: created,
  ...overrides,
});

beforeEach(() => {
  mocks.results.clear();
  mocks.calls.length = 0;
});

describe('toEmergencyContactResponse', () => {
  it('exposes only public fields with ISO dates', () => {
    expect(toEmergencyContactResponse(row())).toEqual({
      id: 'c1',
      name: 'Mom',
      phone: '+15005550006',
      email: null,
      isDefault: true,
      createdAt: '2026-10-01T00:00:00.000Z',
      updatedAt: '2026-10-01T00:00:00.000Z',
    });
  });
});

describe('listEmergencyContacts', () => {
  it('returns the rows for the user', async () => {
    when('safetyCheckIn.listContacts', [row()]);
    expect(await listEmergencyContacts('u1')).toEqual([row()]);
  });
});

describe('createEmergencyContact', () => {
  it('makes the first contact the default and clears others', async () => {
    when('safetyCheckIn.listContacts', []);
    when('safetyCheckIn.createContact', [row()]);

    const result = await createEmergencyContact({
      userId: 'u1',
      request: { id: 'c1', name: 'Mom', phone: '+15005550006' },
    });

    expect(result.id).toBe('c1');
    expect(callsFor('safetyCheckIn.createContact', 'values')[0]).toEqual({
      id: 'c1',
      userId: 'u1',
      name: 'Mom',
      phone: '+15005550006',
      email: null,
      isDefault: true,
    });
    expect(callsFor('safetyCheckIn.clearDefaultContacts', 'set')).toHaveLength(1);
  });

  it('does not make later contacts default unless asked', async () => {
    when('safetyCheckIn.listContacts', [row()]);
    when('safetyCheckIn.createContact', [row({ id: 'c2', isDefault: false })]);

    await createEmergencyContact({
      userId: 'u1',
      request: { id: 'c2', name: 'Dad', email: 'dad@example.com' },
    });

    expect(callsFor('safetyCheckIn.createContact', 'values')[0]).toMatchObject({
      isDefault: false,
      phone: null,
      email: 'dad@example.com',
    });
    expect(callsFor('safetyCheckIn.clearDefaultContacts', 'set')).toHaveLength(0);
  });

  it('returns the stored row when a retried create conflicts', async () => {
    when('safetyCheckIn.listContacts', [row()]);
    when('safetyCheckIn.createContact', []);
    when('safetyCheckIn.getContact', [row()]);

    const result = await createEmergencyContact({
      userId: 'u1',
      request: { id: 'c1', name: 'Mom', phone: '+15005550006', isDefault: true },
    });

    expect(result.name).toBe('Mom');
    expect(callsFor('safetyCheckIn.clearDefaultContacts', 'set')).toHaveLength(0);
  });

  it("throws when the id belongs to someone else's contact", async () => {
    when('safetyCheckIn.listContacts', []);
    when('safetyCheckIn.createContact', []);
    when('safetyCheckIn.getContact', []);

    await expect(
      createEmergencyContact({ userId: 'u1', request: { id: 'c1', name: 'Mom' } }),
    ).rejects.toThrow('Emergency contact id is already in use');
  });
});

describe('updateEmergencyContact', () => {
  it('returns null for a contact the user does not own', async () => {
    when('safetyCheckIn.getContact', []);
    expect(
      await updateEmergencyContact({ userId: 'u1', contactId: 'c9', request: { name: 'X' } }),
    ).toBeNull();
  });

  it('rejects removing the last way to reach the contact', async () => {
    when('safetyCheckIn.getContact', [row()]);
    await expect(
      updateEmergencyContact({ userId: 'u1', contactId: 'c1', request: { phone: null } }),
    ).rejects.toBeInstanceOf(ContactValidationError);
  });

  it('updates the given fields and clears other defaults when made default', async () => {
    when('safetyCheckIn.getContact', [row({ isDefault: false })]);
    when('safetyCheckIn.updateContact', [row({ name: 'Mum', email: 'm@example.com' })]);

    const result = await updateEmergencyContact({
      userId: 'u1',
      contactId: 'c1',
      request: { name: 'Mum', phone: null, email: 'm@example.com', isDefault: true },
    });

    expect(result?.name).toBe('Mum');
    expect(callsFor('safetyCheckIn.updateContact', 'set')[0]).toMatchObject({
      name: 'Mum',
      phone: null,
      email: 'm@example.com',
      isDefault: true,
    });
    expect(callsFor('safetyCheckIn.clearDefaultContacts', 'set')).toHaveLength(1);
  });

  it('keeps existing addresses when only the name changes', async () => {
    when('safetyCheckIn.getContact', [row()]);
    when('safetyCheckIn.updateContact', [row({ name: 'Mother' })]);

    await updateEmergencyContact({ userId: 'u1', contactId: 'c1', request: { name: 'Mother' } });

    const set = callsFor('safetyCheckIn.updateContact', 'set')[0] as Record<string, unknown>;
    expect(Object.keys(set).sort()).toEqual(['name', 'updatedAt']);
    expect(callsFor('safetyCheckIn.clearDefaultContacts', 'set')).toHaveLength(0);
  });

  it('returns null if the row disappears before the update', async () => {
    when('safetyCheckIn.getContact', [row()]);
    when('safetyCheckIn.updateContact', []);
    expect(
      await updateEmergencyContact({ userId: 'u1', contactId: 'c1', request: { name: 'X' } }),
    ).toBeNull();
  });
});

describe('deleteEmergencyContact', () => {
  it('soft-deletes and clears the default flag', async () => {
    when('safetyCheckIn.deleteContact', [{ id: 'c1' }]);
    expect(await deleteEmergencyContact({ userId: 'u1', contactId: 'c1' })).toBe(true);
    expect(callsFor('safetyCheckIn.deleteContact', 'set')[0]).toMatchObject({
      deleted: true,
      isDefault: false,
    });
  });

  it('returns false when nothing matched', async () => {
    when('safetyCheckIn.deleteContact', []);
    expect(await deleteEmergencyContact({ userId: 'u1', contactId: 'c9' })).toBe(false);
  });
});
