import { beforeEach, describe, expect, it } from 'vitest';
import { seedAndLoginTestUser } from './utils/db-helpers';
import { apiWithAuth, expectJsonResponse, expectNotFound } from './utils/test-helpers';

const DENVER = {
  weatherLocationId: 5419384,
  locationName: 'Denver',
  region: 'Colorado',
  country: 'United States',
  lat: 39.74,
  lon: -104.98,
};

describe('Weather monitoring watch-list routes', () => {
  beforeEach(async () => {
    await seedAndLoginTestUser();
  });

  it('starts with an empty watch list', async () => {
    const response = await apiWithAuth('/api/weather/watch-list');
    const body = await expectJsonResponse(response);
    expect(body).toEqual([]);
  });

  it('adds a location and lists it back', async () => {
    const addResponse = await apiWithAuth('/api/weather/watch-list', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(DENVER),
    });
    const added = await expectJsonResponse(addResponse);
    expect(added).toMatchObject({
      weatherLocationId: DENVER.weatherLocationId,
      locationName: 'Denver',
      region: 'Colorado',
      country: 'United States',
    });
    expect(added.id).toEqual(expect.any(String));
    expect(added.createdAt).toEqual(expect.any(String));

    const listResponse = await apiWithAuth('/api/weather/watch-list');
    const list = await expectJsonResponse(listResponse);
    expect(list).toHaveLength(1);
    expect(list[0]).toMatchObject({ weatherLocationId: DENVER.weatherLocationId });
  });

  it('adding the same location twice is idempotent, not a duplicate', async () => {
    await apiWithAuth('/api/weather/watch-list', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(DENVER),
    });
    await apiWithAuth('/api/weather/watch-list', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(DENVER),
    });

    const listResponse = await apiWithAuth('/api/weather/watch-list');
    const list = await expectJsonResponse(listResponse);
    expect(list).toHaveLength(1);
  });

  it('removes a watched location', async () => {
    const addResponse = await apiWithAuth('/api/weather/watch-list', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(DENVER),
    });
    const added = await expectJsonResponse(addResponse);

    const deleteResponse = await apiWithAuth(`/api/weather/watch-list/${added.id}`, {
      method: 'DELETE',
    });
    const deleted = await expectJsonResponse(deleteResponse);
    expect(deleted).toEqual({ success: true });

    const listResponse = await apiWithAuth('/api/weather/watch-list');
    const list = await expectJsonResponse(listResponse);
    expect(list).toEqual([]);
  });

  it('removing a nonexistent watched location returns 404', async () => {
    const response = await apiWithAuth('/api/weather/watch-list/does-not-exist', {
      method: 'DELETE',
    });
    expectNotFound(response);
  });

  it("removing another user's watched location is a no-op 404, not a cross-account delete", async () => {
    const addResponse = await apiWithAuth('/api/weather/watch-list', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(DENVER),
    });
    const added = await expectJsonResponse(addResponse);

    // A second user must not be able to remove the first user's watched location.
    await seedAndLoginTestUser();
    const deleteResponse = await apiWithAuth(`/api/weather/watch-list/${added.id}`, {
      method: 'DELETE',
    });
    expectNotFound(deleteResponse);
  });

  it('registers a device token', async () => {
    const response = await apiWithAuth('/api/weather/device-token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ platform: 'ios', deviceToken: 'deadbeef'.repeat(8) }),
    });
    const body = await expectJsonResponse(response);
    expect(body).toEqual({ success: true });
  });

  it('re-registering the same device token is idempotent', async () => {
    const request = () =>
      apiWithAuth('/api/weather/device-token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ platform: 'ios', deviceToken: 'deadbeef'.repeat(8) }),
      });

    await expectJsonResponse(await request());
    await expectJsonResponse(await request());
  });
});
