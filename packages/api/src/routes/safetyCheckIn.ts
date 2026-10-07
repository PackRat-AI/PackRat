import { authPlugin } from '@packrat/api/middleware/auth';
import { enforceFeatureAccess } from '@packrat/api/middleware/featureGate';
import {
  addLocations,
  CheckInError,
  endCheckIn,
  extendCheckIn,
  getActiveCheckInForTrip,
  getPublicView,
  startCheckIn,
} from '@packrat/api/services/safetyCheckIn/checkInService';
import {
  ContactValidationError,
  createEmergencyContact,
  deleteEmergencyContact,
  listEmergencyContacts,
  toEmergencyContactResponse,
  updateEmergencyContact,
} from '@packrat/api/services/safetyCheckIn/contactsService';
import { renderCheckInPage, renderEndedPage } from '@packrat/api/services/safetyCheckIn/publicPage';
import { FeatureFlag, featureAccessKeyForFlag } from '@packrat/config';
import {
  CreateEmergencyContactRequestSchema,
  EmergencyContactSchema,
  EndSafetyCheckInRequestSchema,
  ExtendSafetyCheckInRequestSchema,
  SafetyCheckInSchema,
  StartSafetyCheckInRequestSchema,
  UpdateEmergencyContactRequestSchema,
  UploadSafetyCheckInLocationsRequestSchema,
} from '@packrat/schemas/safetyCheckIn';
import { Elysia, status } from 'elysia';
import { z } from 'zod';

const SAFETY_CHECK_IN_ACCESS_KEY = featureAccessKeyForFlag(FeatureFlag.EnableSafetyCheckIn);

const authed = (summary: string) => ({
  isAuthenticated: true as const,
  detail: { tags: ['Safety Check-In'], summary, security: [{ bearerAuth: [] }] },
});

/** Translates a domain error into its response; anything else propagates to .onError. */
function translate(error: unknown) {
  if (error instanceof CheckInError) return status(error.httpStatus, { error: error.message });
  if (error instanceof ContactValidationError) return status(400, { error: error.message });
  throw error;
}

export const emergencyContactsRoutes = new Elysia({ prefix: '/emergency-contacts' })
  .model({
    'safetyCheckIn.EmergencyContact': EmergencyContactSchema,
    'safetyCheckIn.CreateEmergencyContactRequest': CreateEmergencyContactRequestSchema,
    'safetyCheckIn.UpdateEmergencyContactRequest': UpdateEmergencyContactRequestSchema,
  })
  .use(authPlugin)
  .get(
    '/',
    async ({ user }) => {
      const denied = await enforceFeatureAccess(SAFETY_CHECK_IN_ACCESS_KEY, user.userId);
      if (denied) return denied;
      const rows = await listEmergencyContacts(user.userId);
      return rows.map(toEmergencyContactResponse);
    },
    authed('List emergency contacts'),
  )
  .post(
    '/',
    async ({ body, user }) => {
      const denied = await enforceFeatureAccess(SAFETY_CHECK_IN_ACCESS_KEY, user.userId);
      if (denied) return denied;
      const row = await createEmergencyContact({ userId: user.userId, request: body });
      return toEmergencyContactResponse(row);
    },
    {
      body: 'safetyCheckIn.CreateEmergencyContactRequest',
      ...authed('Add an emergency contact'),
    },
  )
  .put(
    '/:id',
    async ({ params, body, user }) => {
      const denied = await enforceFeatureAccess(SAFETY_CHECK_IN_ACCESS_KEY, user.userId);
      if (denied) return denied;
      try {
        const row = await updateEmergencyContact({
          userId: user.userId,
          contactId: params.id,
          request: body,
        });
        if (!row) return status(404, { error: 'Emergency contact not found' });
        return toEmergencyContactResponse(row);
      } catch (error) {
        return translate(error);
      }
    },
    {
      params: z.object({ id: z.string() }),
      body: 'safetyCheckIn.UpdateEmergencyContactRequest',
      ...authed('Edit an emergency contact'),
    },
  )
  .delete(
    '/:id',
    async ({ params, user }) => {
      const denied = await enforceFeatureAccess(SAFETY_CHECK_IN_ACCESS_KEY, user.userId);
      if (denied) return denied;
      const removed = await deleteEmergencyContact({ userId: user.userId, contactId: params.id });
      if (!removed) return status(404, { error: 'Emergency contact not found' });
      return { success: true };
    },
    { params: z.object({ id: z.string() }), ...authed('Remove an emergency contact') },
  );

export const safetyCheckInRoutes = new Elysia()
  .model({
    'safetyCheckIn.SafetyCheckIn': SafetyCheckInSchema,
    'safetyCheckIn.StartRequest': StartSafetyCheckInRequestSchema,
    'safetyCheckIn.ExtendRequest': ExtendSafetyCheckInRequestSchema,
    'safetyCheckIn.EndRequest': EndSafetyCheckInRequestSchema,
    'safetyCheckIn.UploadLocationsRequest': UploadSafetyCheckInLocationsRequestSchema,
  })
  .use(authPlugin)
  .get(
    '/trips/:tripId/check-in',
    async ({ params, user }) => {
      const denied = await enforceFeatureAccess(SAFETY_CHECK_IN_ACCESS_KEY, user.userId);
      if (denied) return denied;
      const checkIn = await getActiveCheckInForTrip({
        userId: user.userId,
        tripId: params.tripId,
      });
      return { checkIn };
    },
    {
      params: z.object({ tripId: z.string() }),
      ...authed("Get a trip's active safety check-in"),
    },
  )
  .post(
    '/trips/:tripId/check-in',
    async ({ params, body, user }) => {
      const denied = await enforceFeatureAccess(SAFETY_CHECK_IN_ACCESS_KEY, user.userId);
      if (denied) return denied;
      try {
        return await startCheckIn({ userId: user.userId, tripId: params.tripId, request: body });
      } catch (error) {
        return translate(error);
      }
    },
    {
      params: z.object({ tripId: z.string() }),
      body: 'safetyCheckIn.StartRequest',
      ...authed('Start a safety check-in and notify contacts'),
    },
  )
  .post(
    '/safety-check-ins/:id/extend',
    async ({ params, body, user }) => {
      const denied = await enforceFeatureAccess(SAFETY_CHECK_IN_ACCESS_KEY, user.userId);
      if (denied) return denied;
      try {
        return await extendCheckIn({
          userId: user.userId,
          checkInId: params.id,
          expectedReturnAt: body.expectedReturnAt,
        });
      } catch (error) {
        return translate(error);
      }
    },
    {
      params: z.object({ id: z.string() }),
      body: 'safetyCheckIn.ExtendRequest',
      ...authed('Push the expected return back'),
    },
  )
  .post(
    '/safety-check-ins/:id/safe',
    async ({ params, body, user }) => {
      const denied = await enforceFeatureAccess(SAFETY_CHECK_IN_ACCESS_KEY, user.userId);
      if (denied) return denied;
      try {
        return await endCheckIn({
          userId: user.userId,
          checkInId: params.id,
          outcome: 'safe',
          endedAt: body.endedAt,
        });
      } catch (error) {
        return translate(error);
      }
    },
    {
      params: z.object({ id: z.string() }),
      body: 'safetyCheckIn.EndRequest',
      ...authed("I'm Safe: end the check-in and complete the trip"),
    },
  )
  .post(
    '/safety-check-ins/:id/cancel',
    async ({ params, body, user }) => {
      const denied = await enforceFeatureAccess(SAFETY_CHECK_IN_ACCESS_KEY, user.userId);
      if (denied) return denied;
      try {
        return await endCheckIn({
          userId: user.userId,
          checkInId: params.id,
          outcome: 'cancelled',
          endedAt: body.endedAt,
        });
      } catch (error) {
        return translate(error);
      }
    },
    {
      params: z.object({ id: z.string() }),
      body: 'safetyCheckIn.EndRequest',
      ...authed('Call off a safety check-in'),
    },
  )
  .post(
    '/safety-check-ins/:id/locations',
    async ({ params, body, user }) => {
      const denied = await enforceFeatureAccess(SAFETY_CHECK_IN_ACCESS_KEY, user.userId);
      if (denied) return denied;
      try {
        return await addLocations({
          userId: user.userId,
          checkInId: params.id,
          locations: body.locations,
        });
      } catch (error) {
        return translate(error);
      }
    },
    {
      params: z.object({ id: z.string() }),
      body: 'safetyCheckIn.UploadLocationsRequest',
      ...authed('Upload check-ins and tracked locations'),
    },
  );

/** The page emergency contacts open from their messages. No account needed. */
export const safetyCheckInPublicRoutes = new Elysia({ prefix: '/safety' }).get(
  '/:token',
  async ({ params, set }) => {
    set.headers['content-type'] = 'text/html; charset=utf-8';
    set.headers['cache-control'] = 'no-store';
    // Origin only: map tile servers require a referrer, and sending just the
    // origin keeps the share token out of third-party logs.
    set.headers['referrer-policy'] = 'strict-origin-when-cross-origin';
    const view = await getPublicView(params.token);
    if (!view) {
      set.status = 404;
      return renderEndedPage();
    }
    return renderCheckInPage(view);
  },
  {
    params: z.object({ token: z.string().min(16).max(64) }),
    detail: { tags: ['Safety Check-In'], summary: 'Public trip page for emergency contacts' },
  },
);
