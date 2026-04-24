import { createApiClient } from '@packrat/api-client';
import { clientEnvs } from '@packrat/env/expo-client';
import { createRpcFetch } from './rpcTransport';

export const rpcClient = createApiClient(clientEnvs.EXPO_PUBLIC_API_URL, {
  fetch: createRpcFetch(),
});
