import type { AppType } from '@packrat/api';
import type { InferRequestType, InferResponseType } from 'hono/client';
import type { StatusCode } from 'hono/utils/http-status';

export type RpcAppType = AppType;

export type ApiClient = ReturnType<typeof import('./client').createApiClient>;

type ApiEndpointFn = (...args: never[]) => Promise<unknown>;

export type ApiRequestOf<T extends ApiEndpointFn> = InferRequestType<T>;
export type ApiResponseOf<
  T extends ApiEndpointFn,
  TStatus extends StatusCode = 200,
> = InferResponseType<T, TStatus>;
