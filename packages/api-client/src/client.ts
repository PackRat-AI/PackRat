import type { AppType } from '@packrat/api';
import { type ClientRequestOptions, hc } from 'hono/client';

export type ApiClientOptions = ClientRequestOptions;

export const createApiClient = (baseUrl: string, options?: ApiClientOptions) => {
  return hc<AppType>(baseUrl, options);
};
