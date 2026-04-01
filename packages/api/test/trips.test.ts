import { beforeAll, describe, expect, it } from 'vitest';
import { seedPack, seedTestUser } from './utils/db-helpers';
import {
  apiWithAuth,
  expectBadRequest,
  expectJsonResponse,
  expectNotFound,
  expectUnauthorized,
  TEST_USER,
} from './utils/test-helpers';

// Test data
const TRIP_ID = `trip-test-${Date.now()}`;
const TRIP_ID_2 = `trip-test-2-${Date.now()}`;
let testUserId: number;
let testPackId: string;

beforeAll(async () => {
  // Seed test user
  const user = await seedTestUser({ id: TEST_USER.id, email: TEST_USER.email });
  testUserId = user.id;

  // Seed a test pack for trip association
  const pack = await seedPack({ userId: testUserId });
  testPackId = pack.id;
});

describe('Trip Routes', () => {
  describe('POST /api/trips', () => {
    it('should create a new trip', async () => {
      const tripData = {
        id: TRIP_ID,
        name: 'Mountain Hiking Trip',
        description: 'A weekend hiking adventure',
        location: {
          latitude: 40.7128,
          longitude: -74.006,
          name: 'New York',
        },
        startDate: new Date('2026-06-01').toISOString(),
        endDate: new Date('2026-06-03').toISOString(),
        notes: 'Bring extra water',
        packId: testPackId,
        localCreatedAt: new Date().toISOString(),
        localUpdatedAt: new Date().toISOString(),
      };

      const response = await apiWithAuth('/trips', {
        method: 'POST',
        body: JSON.stringify(tripData),
      });

      expectJsonResponse(response, 200);
      const trip = await response.json();
      expect(trip).toMatchObject({
        id: TRIP_ID,
        name: 'Mountain Hiking Trip',
        description: 'A weekend hiking adventure',
        userId: testUserId,
        packId: testPackId,
        deleted: false,
      });
      expect(trip.location).toMatchObject({
        latitude: 40.7128,
        longitude: -74.006,
        name: 'New York',
      });
    });

    it('should create a trip without optional fields', async () => {
      const tripData = {
        id: TRIP_ID_2,
        name: 'Simple Trip',
        localCreatedAt: new Date().toISOString(),
        localUpdatedAt: new Date().toISOString(),
      };

      const response = await apiWithAuth('/trips', {
        method: 'POST',
        body: JSON.stringify(tripData),
      });

      expectJsonResponse(response, 200);
      const trip = await response.json();
      expect(trip).toMatchObject({
        id: TRIP_ID_2,
        name: 'Simple Trip',
        userId: testUserId,
        deleted: false,
      });
      expect(trip.description).toBeNull();
      expect(trip.packId).toBeNull();
    });

    it('should return 400 if trip ID is missing', async () => {
      const tripData = {
        name: 'No ID Trip',
        localCreatedAt: new Date().toISOString(),
        localUpdatedAt: new Date().toISOString(),
      };

      const response = await apiWithAuth('/trips', {
        method: 'POST',
        body: JSON.stringify(tripData),
      });

      expectBadRequest(response);
      const error = await response.json();
      expect(error.error).toContain('Trip ID is required');
    });

    it('should return 401 if not authenticated', async () => {
      const tripData = {
        id: 'unauthorized-trip',
        name: 'Unauthorized Trip',
        localCreatedAt: new Date().toISOString(),
        localUpdatedAt: new Date().toISOString(),
      };

      const response = await fetch('http://localhost/api/trips', {
        method: 'POST',
        body: JSON.stringify(tripData),
        headers: { 'Content-Type': 'application/json' },
      });

      expectUnauthorized(response);
    });
  });

  describe('GET /api/trips', () => {
    it('should list all user trips', async () => {
      const response = await apiWithAuth('/trips');

      expectJsonResponse(response, 200);
      const trips = await response.json();
      expect(Array.isArray(trips)).toBe(true);
      expect(trips.length).toBeGreaterThanOrEqual(2);
      // Should include our created trips
      const tripIds = trips.map((t: { id: string }) => t.id);
      expect(tripIds).toContain(TRIP_ID);
      expect(tripIds).toContain(TRIP_ID_2);
    });

    it('should return only user-owned trips by default', async () => {
      const response = await apiWithAuth('/trips');

      expectJsonResponse(response, 200);
      const trips = await response.json();
      // All trips should belong to the test user
      trips.forEach((trip: { userId: number }) => {
        expect(trip.userId).toBe(testUserId);
      });
    });

    it('should respect includePublic query parameter', async () => {
      const response = await apiWithAuth('/trips?includePublic=1');

      expectJsonResponse(response, 200);
      const trips = await response.json();
      expect(Array.isArray(trips)).toBe(true);
    });

    it('should return 401 if not authenticated', async () => {
      const response = await fetch('http://localhost/api/trips');

      expectUnauthorized(response);
    });
  });

  describe('GET /api/trips/:tripId', () => {
    it('should get a specific trip by ID', async () => {
      const response = await apiWithAuth(`/trips/${TRIP_ID}`);

      expectJsonResponse(response, 200);
      const trip = await response.json();
      expect(trip).toMatchObject({
        id: TRIP_ID,
        name: 'Mountain Hiking Trip',
        userId: testUserId,
      });
    });

    it('should include pack details if associated', async () => {
      const response = await apiWithAuth(`/trips/${TRIP_ID}`);

      expectJsonResponse(response, 200);
      const trip = await response.json();
      expect(trip.packId).toBe(testPackId);
      // Check if pack details are included
      if (trip.pack) {
        expect(trip.pack.id).toBe(testPackId);
      }
    });

    it('should return 404 for non-existent trip', async () => {
      const response = await apiWithAuth('/trips/non-existent-trip-id');

      expectNotFound(response);
    });

    it('should return 404 for trips owned by other users', async () => {
      // Create a second user
      const otherUser = await seedTestUser({
        email: `other-${Date.now()}@example.com`,
      });

      // Try to access TRIP_ID with other user's token
      const response = await apiWithAuth(
        `/trips/${TRIP_ID}`,
        undefined,
        { id: otherUser.id, email: otherUser.email, firstName: 'Other', lastName: 'User', role: 'USER' },
      );

      expectNotFound(response);
    });

    it('should return 401 if not authenticated', async () => {
      const response = await fetch(`http://localhost/api/trips/${TRIP_ID}`);

      expectUnauthorized(response);
    });
  });

  describe('PUT /api/trips/:tripId', () => {
    it('should update trip name', async () => {
      const response = await apiWithAuth(`/trips/${TRIP_ID}`, {
        method: 'PUT',
        body: JSON.stringify({
          name: 'Updated Mountain Hiking Trip',
        }),
      });

      expectJsonResponse(response, 200);
      const trip = await response.json();
      expect(trip.name).toBe('Updated Mountain Hiking Trip');
      expect(trip.id).toBe(TRIP_ID);
    });

    it('should update trip location', async () => {
      const response = await apiWithAuth(`/trips/${TRIP_ID}`, {
        method: 'PUT',
        body: JSON.stringify({
          location: {
            latitude: 37.7749,
            longitude: -122.4194,
            name: 'San Francisco',
          },
        }),
      });

      expectJsonResponse(response, 200);
      const trip = await response.json();
      expect(trip.location).toMatchObject({
        latitude: 37.7749,
        longitude: -122.4194,
        name: 'San Francisco',
      });
    });

    it('should update trip dates', async () => {
      const newStartDate = new Date('2026-07-01').toISOString();
      const newEndDate = new Date('2026-07-05').toISOString();

      const response = await apiWithAuth(`/trips/${TRIP_ID}`, {
        method: 'PUT',
        body: JSON.stringify({
          startDate: newStartDate,
          endDate: newEndDate,
        }),
      });

      expectJsonResponse(response, 200);
      const trip = await response.json();
      expect(new Date(trip.startDate).toISOString()).toBe(newStartDate);
      expect(new Date(trip.endDate).toISOString()).toBe(newEndDate);
    });

    it('should update multiple fields at once', async () => {
      const response = await apiWithAuth(`/trips/${TRIP_ID}`, {
        method: 'PUT',
        body: JSON.stringify({
          name: 'Multi-Field Updated Trip',
          description: 'Updated description',
          notes: 'Updated notes',
        }),
      });

      expectJsonResponse(response, 200);
      const trip = await response.json();
      expect(trip.name).toBe('Multi-Field Updated Trip');
      expect(trip.description).toBe('Updated description');
      expect(trip.notes).toBe('Updated notes');
    });

    it('should clear optional fields when set to null', async () => {
      const response = await apiWithAuth(`/trips/${TRIP_ID}`, {
        method: 'PUT',
        body: JSON.stringify({
          description: null,
          notes: null,
        }),
      });

      expectJsonResponse(response, 200);
      const trip = await response.json();
      expect(trip.description).toBeNull();
      expect(trip.notes).toBeNull();
    });

    it('should return 404 for non-existent trip', async () => {
      const response = await apiWithAuth('/trips/non-existent-trip', {
        method: 'PUT',
        body: JSON.stringify({ name: 'Should Fail' }),
      });

      expectNotFound(response);
    });

    it('should not update trips owned by other users', async () => {
      // Create a second user
      const otherUser = await seedTestUser({
        email: `other2-${Date.now()}@example.com`,
      });

      const response = await apiWithAuth(
        `/trips/${TRIP_ID}`,
        {
          method: 'PUT',
          body: JSON.stringify({ name: 'Unauthorized Update' }),
        },
        { id: otherUser.id, email: otherUser.email, firstName: 'Other', lastName: 'User', role: 'USER' },
      );

      expectNotFound(response);
    });

    it('should return 401 if not authenticated', async () => {
      const response = await fetch(`http://localhost/api/trips/${TRIP_ID}`, {
        method: 'PUT',
        body: JSON.stringify({ name: 'Should Fail' }),
        headers: { 'Content-Type': 'application/json' },
      });

      expectUnauthorized(response);
    });
  });

  describe('DELETE /api/trips/:tripId', () => {
    it('should delete a trip', async () => {
      // Create a trip to delete
      const tripToDelete = {
        id: `trip-to-delete-${Date.now()}`,
        name: 'Trip to Delete',
        localCreatedAt: new Date().toISOString(),
        localUpdatedAt: new Date().toISOString(),
      };

      await apiWithAuth('/trips', {
        method: 'POST',
        body: JSON.stringify(tripToDelete),
      });

      const response = await apiWithAuth(`/trips/${tripToDelete.id}`, {
        method: 'DELETE',
      });

      expectJsonResponse(response, 200);
      const result = await response.json();
      expect(result.success).toBe(true);

      // Verify trip is deleted (should return 404)
      const getResponse = await apiWithAuth(`/trips/${tripToDelete.id}`);
      expectNotFound(getResponse);
    });

    it('should return 403 for non-existent or unauthorized trip', async () => {
      const response = await apiWithAuth('/trips/non-existent-trip-id', {
        method: 'DELETE',
      });

      expect(response.status).toBe(403);
    });

    it('should not delete trips owned by other users', async () => {
      // Create a second user
      const otherUser = await seedTestUser({
        email: `other3-${Date.now()}@example.com`,
      });

      const response = await apiWithAuth(
        `/trips/${TRIP_ID}`,
        { method: 'DELETE' },
        { id: otherUser.id, email: otherUser.email, firstName: 'Other', lastName: 'User', role: 'USER' },
      );

      expect(response.status).toBe(403);
      const error = await response.json();
      expect(error.error).toContain('not found or unauthorized');
    });

    it('should return 401 if not authenticated', async () => {
      const response = await fetch(`http://localhost/api/trips/${TRIP_ID}`, {
        method: 'DELETE',
      });

      expectUnauthorized(response);
    });
  });
});
