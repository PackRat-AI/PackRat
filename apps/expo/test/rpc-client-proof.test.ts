import { type ApiRequestOf, type ApiResponseOf, createApiClient } from '@packrat/api-client';
import { expectTypeOf, test } from 'vitest';

const client = createApiClient('https://packrat.test');
const guideGetById = client.api.guides[':id'].$get;
const catalogGetById = client.api.catalog[':id'].$get;
const tripGetById = client.api.trips[':tripId'].$get;
type GuideGetById = typeof guideGetById;
type CatalogGetById = typeof catalogGetById;
type TripGetById = typeof tripGetById;

test('Expo can consume typed guide and catalog RPC requests', () => {
  const guideRequest: ApiRequestOf<GuideGetById> = {
    param: {
      id: 'ultralight-backpacking',
    },
  };

  const catalogQuery: ApiRequestOf<typeof client.api.catalog.$get> = {
    query: {
      q: 'sleeping bag',
      page: '1',
      limit: '10',
    },
  };

  expectTypeOf(guideRequest.param.id).toEqualTypeOf<string>();
  expectTypeOf(catalogQuery.query?.page).toEqualTypeOf<string | undefined>();
});

test('Expo can narrow typed RPC responses by route and status', () => {
  type GuideResponse = ApiResponseOf<GuideGetById>;
  type MissingCatalogItem = ApiResponseOf<CatalogGetById, 404>;

  expectTypeOf<GuideResponse>().toMatchTypeOf<{
    id: string;
    title: string;
    content: string;
  }>();

  expectTypeOf<MissingCatalogItem>().toMatchTypeOf<{
    error: string;
  }>();
});

test('Expo can consume typed trips RPC requests', () => {
  const createRequest: ApiRequestOf<typeof client.api.trips.$post> = {
    json: {
      id: 't_123',
      name: 'Pacific Crest Trail',
      localCreatedAt: new Date().toISOString(),
      localUpdatedAt: new Date().toISOString(),
    },
  };

  const byIdRequest: ApiRequestOf<TripGetById> = {
    param: { tripId: 't_123' },
  };

  expectTypeOf(createRequest.json.name).toEqualTypeOf<string>();
  expectTypeOf(byIdRequest.param.tripId).toEqualTypeOf<string>();
});

test('Expo can narrow typed trips RPC responses by status', () => {
  type TripResponse = ApiResponseOf<TripGetById>;
  type MissingTrip = ApiResponseOf<TripGetById, 404>;

  expectTypeOf<TripResponse>().toMatchTypeOf<{
    id: string;
    name: string;
    userId: number;
  }>();

  expectTypeOf<MissingTrip>().toMatchTypeOf<{
    error: string;
  }>();
});
