import { expectTypeOf, test } from 'vitest';
import { type ApiRequestOf, type ApiResponseOf, createApiClient } from '../src';

const client = createApiClient('https://packrat.test');
const catalogGetById = client.api.catalog[':id'].$get;
type CatalogGetById = typeof catalogGetById;
const tripGetById = client.api.trips[':tripId'].$get;
type TripGetById = typeof tripGetById;
const tripDeleteById = client.api.trips[':tripId'].$delete;
type TripDeleteById = typeof tripDeleteById;

test('catalog RPC requests stay inferred', () => {
  const listRequest: ApiRequestOf<typeof client.api.catalog.$get> = {
    query: {
      page: '1',
      limit: '20',
      q: 'tent',
    },
  };

  const createRequest: ApiRequestOf<typeof client.api.catalog.$post> = {
    json: {
      name: 'Test tent',
      productUrl: 'https://example.com/products/tent',
      sku: 'tent-123',
      weight: 1000,
      weightUnit: 'g',
    },
  };

  const byIdRequest: ApiRequestOf<CatalogGetById> = {
    param: {
      id: '123',
    },
  };

  expectTypeOf(listRequest.query?.page).toEqualTypeOf<string | undefined>();
  expectTypeOf(createRequest.json.name).toEqualTypeOf<string>();
  expectTypeOf(byIdRequest.param.id).toEqualTypeOf<string>();
});

test('catalog RPC responses stay inferred by status code', () => {
  type ListResponse = ApiResponseOf<typeof client.api.catalog.$get>;
  type ItemResponse = ApiResponseOf<CatalogGetById>;
  type MissingItemResponse = ApiResponseOf<CatalogGetById, 404>;

  expectTypeOf<ListResponse>().toMatchTypeOf<{
    items: unknown[];
    totalCount: number;
    page: number;
    limit: number;
    totalPages: number;
  }>();

  expectTypeOf<ItemResponse>().toMatchTypeOf<{
    id: number;
    name: string;
  }>();

  expectTypeOf<MissingItemResponse>().toMatchTypeOf<{
    error: string;
  }>();
});

test('trips RPC requests stay inferred', () => {
  const createRequest: ApiRequestOf<typeof client.api.trips.$post> = {
    json: {
      id: 't_123',
      name: 'Summer Trip',
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

test('trips RPC responses stay inferred by status code', () => {
  type TripResponse = ApiResponseOf<TripGetById>;
  type MissingTripResponse = ApiResponseOf<TripGetById, 404>;
  type DeleteResponse = ApiResponseOf<TripDeleteById>;

  expectTypeOf<TripResponse>().toMatchTypeOf<{
    id: string;
    name: string;
    userId: number;
  }>();

  expectTypeOf<MissingTripResponse>().toMatchTypeOf<{
    error: string;
  }>();

  expectTypeOf<DeleteResponse>().toMatchTypeOf<{
    success: boolean;
  }>();
});
