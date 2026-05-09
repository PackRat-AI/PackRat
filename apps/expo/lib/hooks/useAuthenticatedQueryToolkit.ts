import { authClient } from 'expo-app/lib/auth-client';

export const useAuthenticatedQueryToolkit = () => {
  const { data: session } = authClient.useSession();
  const isQueryEnabledWithAccessToken = Boolean(session?.session?.token);

  return {
    isQueryEnabledWithAccessToken,
  };
};
