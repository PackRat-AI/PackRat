import { type ApiRequestOf, type ApiResponseOf, createApiClient } from '@packrat/api-client';
import { expectTypeOf, test } from 'vitest';

const client = createApiClient('https://packrat.test');
const guideGetById = client.api.guides[':id'].$get;
const catalogGetById = client.api.catalog[':id'].$get;
type GuideGetById = typeof guideGetById;
type CatalogGetById = typeof catalogGetById;

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
