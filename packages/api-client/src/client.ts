import { hc, type ClientRequestOptions } from 'hono/client';
import type { AppType } from '@packrat/api';

export type ApiClientOptions = ClientRequestOptions;

export const createApiClient = (baseUrl: string, options?: ApiClientOptions) => {
  return hc<AppType>(baseUrl, options);
};
