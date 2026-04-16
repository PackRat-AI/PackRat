import { createApiClient } from '@packrat/api-client';
import { clientEnvs } from 'expo-app/env/clientEnvs';
import { createRpcFetch } from './rpcTransport';

export const rpcClient = createApiClient(clientEnvs.EXPO_PUBLIC_API_URL, {
  fetch: createRpcFetch(),
});
