/**
 * Re-export the PackRat API client primitives from the shared api-client package.
 * MCP tool files import from here to keep their dependencies clean.
 */

export type {
  ApiErrorOptions,
  PackRatApiClient as PackRatClient,
  QueryParams,
} from '@packrat/api-client';
export {
  ApiError,
  createPackRatClient,
  err,
  ok,
  PackRatApiClient,
} from '@packrat/api-client';
