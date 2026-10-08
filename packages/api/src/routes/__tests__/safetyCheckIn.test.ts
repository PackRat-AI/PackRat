import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  getAuth: vi.fn(),
  enforceFeatureAccess: vi.fn(),
  listEmergencyContacts: vi.fn(),
  createEmergencyContact: vi.fn(),
  updateEmergencyContact: vi.fn(),
  deleteEmergencyContact: vi.fn(),
  getActiveCheckInForTrip: vi.fn(),
  startCheckIn: vi.fn(),
  extendCheckIn: vi.fn(),
  endCheckIn: vi.fn(),
  addLocations: vi.fn(),
  getPublicView: vi.fn(),
  renderCheckInPage: vi.fn(),
  renderEndedPage: vi.fn(),
}));

vi.mock('@packrat/api/auth', () => ({ getAuth: mocks.getAuth }));
vi.mock('@packrat/api/auth/local-e2e', () => ({
  getLocalE2EUserFromRequest: vi.fn(async () => null),
}));
vi.mock('@packrat/api/auth/mcp-token', () => ({ resolveMcpBearerUser: vi.fn(async () => null) }));
vi.mock('@packrat/api/utils/env-validation', () => ({ getEnv: vi.fn(() => ({})) }));
vi.mock('@packrat/api/utils/queryMetrics', () => ({ setQueryMetricsUser: vi.fn() }));
vi.mock('@packrat/api/utils/sentry', () => ({
  apiAddBreadcrumb: vi.fn(),
  captureApiException: vi.fn(),
  setApiUser: vi.fn(),
}));
vi.mock('@packrat/api/middleware/featureGate', () => ({
  enforceFeatureAccess: mocks.enforceFeatureAccess,
}));
vi.mock('@packrat/api/services/safetyCheckIn/contactsService', async () => {
  class ContactValidationError extends Error {
    constructor() {
      super('need one');
    }
  }
  return {
    ContactValidationError,
    listEmergencyContacts: mocks.listEmergencyContacts,
    createEmergencyContact: mocks.createEmergencyContact,
    updateEmergencyContact: mocks.updateEmergencyContact,
    deleteEmergencyContact: mocks.deleteEmergencyContact,
    toEmergencyContactResponse: (row: { id: string; createdAt: Date }) => ({
      id: row.id,
      createdAt: row.createdAt.toISOString(),
    }),
  };
});
vi.mock('@packrat/api/services/safetyCheckIn/checkInService', () => {
  class CheckInError extends Error {
    readonly httpStatus: number;

    constructor({ message, httpStatus }: { message: string; httpStatus: number }) {
      super(message);
      this.httpStatus = httpStatus;
    }
  }
  return {
    CheckInError,
    getActiveCheckInForTrip: mocks.getActiveCheckInForTrip,
    startCheckIn: mocks.startCheckIn,
    extendCheckIn: mocks.extendCheckIn,
    endCheckIn: mocks.endCheckIn,
    addLocations: mocks.addLocations,
    getPublicView: mocks.getPublicView,
  };
});
vi.mock('@packrat/api/services/safetyCheckIn/publicPage', () => ({
  renderCheckInPage: mocks.renderCheckInPage,
  renderEndedPage: mocks.renderEndedPage,
}));

import {
  emergencyContactsRoutes,
  safetyCheckInPublicRoutes,
  safetyCheckInRoutes,
} from '@packrat/api/routes/safetyCheckIn';
import { CheckInError } from '@packrat/api/services/safetyCheckIn/checkInService';
import { ContactValidationError } from '@packrat/api/services/safetyCheckIn/contactsService';
import { Elysia, status } from 'elysia';

const app = new Elysia()
  .use(emergencyContactsRoutes)
  .use(safetyCheckInRoutes)
  .use(safetyCheckInPublicRoutes);

const json = (...[method, path, body]: [method: string, path: string, body?: unknown]) =>
  app.handle(
    new Request(`http://localhost${path}`, {
      method,
      headers: { 'content-type': 'application/json', authorization: 'Bearer t' },
      body: body === undefined ? undefined : JSON.stringify(body),
    }),
  );

const ENDED = { endedAt: '2026-09-14T01:00:00.000Z' };
const START = {
  id: 'ci-1',
  contactIds: ['c1'],
  expectedReturnAt: '2026-09-14T02:00:00.000Z',
  startedAt: '2026-09-13T15:00:00.000Z',
  timeZone: 'America/Los_Angeles',
};

beforeEach(() => {
  vi.clearAllMocks();
  mocks.getAuth.mockResolvedValue({
    api: {
      getSession: vi.fn(async () => ({
        user: { id: 'u1', email: 'a@example.com', name: 'Alex', role: 'USER' },
      })),
    },
  });
  mocks.enforceFeatureAccess.mockResolvedValue(null);
});

describe('feature gate', () => {
  it('denies every authenticated endpoint when access is closed', async () => {
    mocks.enforceFeatureAccess.mockImplementation(async () =>
      status(403, { error: 'early access' }),
    );

    // Sequential: the auth plugin's session lookup isn't safe to race in tests.
    const requests: [string, string, unknown?][] = [
      ['GET', '/emergency-contacts'],
      ['POST', '/emergency-contacts', { id: 'c1', name: 'Mom', phone: '+15005550006' }],
      ['PUT', '/emergency-contacts/c1', { name: 'Mum' }],
      ['DELETE', '/emergency-contacts/c1'],
      ['GET', '/trips/t1/check-in'],
      ['POST', '/trips/t1/check-in', START],
      ['POST', '/safety-check-ins/ci-1/extend', { expectedReturnAt: START.expectedReturnAt }],
      ['POST', '/safety-check-ins/ci-1/safe', ENDED],
      ['POST', '/safety-check-ins/ci-1/cancel', ENDED],
      [
        'POST',
        '/safety-check-ins/ci-1/locations',
        {
          locations: [
            { id: 'l1', kind: 'check_in', latitude: 1, longitude: 2, recordedAt: ENDED.endedAt },
          ],
        },
      ],
    ];
    const responses: Response[] = [];
    for (const [method, path, body] of requests) responses.push(await json(method, path, body));

    expect(responses.map((r) => r.status)).toEqual(Array(10).fill(403));
    expect(mocks.enforceFeatureAccess).toHaveBeenCalledWith('safety-check-in', 'u1');
    expect(mocks.startCheckIn).toHaveBeenCalledTimes(0);
    expect(mocks.listEmergencyContacts).toHaveBeenCalledTimes(0);
  });
});

describe('emergency contacts routes', () => {
  it('lists, creates and deletes', async () => {
    const createdAt = new Date('2026-10-01T00:00:00.000Z');
    mocks.listEmergencyContacts.mockResolvedValue([{ id: 'c1', createdAt }]);
    mocks.createEmergencyContact.mockResolvedValue({ id: 'c2', createdAt });
    mocks.deleteEmergencyContact.mockResolvedValue(true);

    const list = await json('GET', '/emergency-contacts');
    expect(await list.json()).toEqual([{ id: 'c1', createdAt: '2026-10-01T00:00:00.000Z' }]);

    const create = await json('POST', '/emergency-contacts', {
      id: 'c2',
      name: 'Dad',
      email: 'd@example.com',
    });
    expect(await create.json()).toEqual({ id: 'c2', createdAt: '2026-10-01T00:00:00.000Z' });
    expect(mocks.createEmergencyContact.mock.calls[0]?.[0]).toMatchObject({
      userId: 'u1',
      request: { id: 'c2', name: 'Dad', email: 'd@example.com' },
    });

    expect(await (await json('DELETE', '/emergency-contacts/c2')).json()).toEqual({
      success: true,
    });
  });

  it('rejects a contact with no phone or email', async () => {
    const res = await json('POST', '/emergency-contacts', { id: 'c3', name: 'Nobody' });
    expect(res.status).toBe(422);
    expect(mocks.createEmergencyContact).toHaveBeenCalledTimes(0);
  });

  it('404s on update/delete of an unknown contact', async () => {
    mocks.updateEmergencyContact.mockResolvedValue(null);
    mocks.deleteEmergencyContact.mockResolvedValue(false);
    expect((await json('PUT', '/emergency-contacts/x', { name: 'X' })).status).toBe(404);
    expect((await json('DELETE', '/emergency-contacts/x')).status).toBe(404);
  });

  it('returns the updated contact', async () => {
    mocks.updateEmergencyContact.mockResolvedValue({ id: 'c1', createdAt: new Date(0) });
    const res = await json('PUT', '/emergency-contacts/c1', { name: 'Mum' });
    expect(await res.json()).toEqual({ id: 'c1', createdAt: '1970-01-01T00:00:00.000Z' });
  });

  it('translates a validation error to 400 and rethrows anything else', async () => {
    mocks.updateEmergencyContact.mockRejectedValueOnce(new ContactValidationError());
    const bad = await json('PUT', '/emergency-contacts/c1', { phone: null });
    expect(bad.status).toBe(400);
    expect(await bad.json()).toEqual({ error: 'need one' });

    mocks.updateEmergencyContact.mockRejectedValueOnce(new Error('db down'));
    expect((await json('PUT', '/emergency-contacts/c1', { name: 'X' })).status).toBe(500);
  });
});

describe('check-in routes', () => {
  it('returns the active check-in wrapper', async () => {
    mocks.getActiveCheckInForTrip.mockResolvedValue(null);
    const res = await json('GET', '/trips/t1/check-in');
    expect(await res.json()).toEqual({ checkIn: null });
    expect(mocks.getActiveCheckInForTrip).toHaveBeenCalledWith({ userId: 'u1', tripId: 't1' });
  });

  it('starts with schema defaults applied', async () => {
    mocks.startCheckIn.mockResolvedValue({ id: 'ci-1' });
    const res = await json('POST', '/trips/t1/check-in', START);
    expect(await res.json()).toEqual({ id: 'ci-1' });
    expect(mocks.startCheckIn.mock.calls[0]?.[0]).toMatchObject({
      userId: 'u1',
      tripId: 't1',
      request: { graceMinutes: 120, trackingEnabled: false, identifyingGear: [] },
    });
  });

  it.each([
    ['POST', '/trips/t1/check-in', START, 'startCheckIn'],
    [
      'POST',
      '/safety-check-ins/ci-1/extend',
      { expectedReturnAt: START.expectedReturnAt },
      'extendCheckIn',
    ],
    ['POST', '/safety-check-ins/ci-1/safe', ENDED, 'endCheckIn'],
    ['POST', '/safety-check-ins/ci-1/cancel', ENDED, 'endCheckIn'],
    [
      'POST',
      '/safety-check-ins/ci-1/locations',
      {
        locations: [
          { id: 'l1', kind: 'track', latitude: 1, longitude: 2, recordedAt: ENDED.endedAt },
        ],
      },
      'addLocations',
    ],
  ] as const)('%s %s translates CheckInError and returns results', async (...[
    method,
    path,
    body,
    fn,
  ]) => {
    const service = mocks[fn];
    service.mockRejectedValueOnce(
      new CheckInError({ message: 'This check-in has ended', httpStatus: 409 }),
    );
    const conflict = await json(method, path, body);
    expect(conflict.status).toBe(409);
    expect(await conflict.json()).toEqual({ error: 'This check-in has ended' });

    service.mockResolvedValueOnce({ ok: fn });
    const ok = await json(method, path, body);
    expect(ok.status).toBe(200);
    expect(await ok.json()).toEqual({ ok: fn });
  });

  it('passes the outcome for safe and cancel', async () => {
    mocks.endCheckIn.mockResolvedValue({});
    await json('POST', '/safety-check-ins/ci-1/safe', ENDED);
    await json('POST', '/safety-check-ins/ci-1/cancel', ENDED);
    expect(mocks.endCheckIn.mock.calls.map((c) => c[0].outcome)).toEqual(['safe', 'cancelled']);
  });
});

describe('public contacts page', () => {
  const token = 'abcdefghijklmnopqrstuvwxyz';

  it('renders the page without auth and never caches it', async () => {
    mocks.getPublicView.mockResolvedValue({ checkIn: { id: 'ci-1' } });
    mocks.renderCheckInPage.mockReturnValue('<html>trip</html>');

    const res = await app.handle(new Request(`http://localhost/safety/${token}`));

    expect(res.status).toBe(200);
    expect(await res.text()).toBe('<html>trip</html>');
    expect(res.headers.get('content-type')).toBe('text/html; charset=utf-8');
    expect(res.headers.get('cache-control')).toBe('no-store');
    expect(res.headers.get('referrer-policy')).toBe('strict-origin-when-cross-origin');
    expect(mocks.getAuth).toHaveBeenCalledTimes(0);
  });

  it('404s with the ended page once the check-in is over', async () => {
    mocks.getPublicView.mockResolvedValue(null);
    mocks.renderEndedPage.mockReturnValue('<html>ended</html>');

    const res = await app.handle(new Request(`http://localhost/safety/${token}`));

    expect(res.status).toBe(404);
    expect(await res.text()).toBe('<html>ended</html>');
  });

  it('rejects malformed tokens', async () => {
    const res = await app.handle(new Request('http://localhost/safety/short'));
    expect(res.status).toBe(422);
    expect(mocks.getPublicView).toHaveBeenCalledTimes(0);
  });
});
