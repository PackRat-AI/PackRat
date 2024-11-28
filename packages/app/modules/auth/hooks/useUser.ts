import { useMemo, useState } from 'react';
import { useStorage } from 'app/hooks/storage/useStorage';
import { queryTrpc } from 'app/trpc';
import { useLogout } from './useLogout';
import { useDeepCompareEffect } from 'app/hooks/common/useDeepCompareEffect';
import { Storage } from 'app/utils/storage';
import { useOfflineStore } from 'app/atoms';

export const useAuthUserToken = () => {
  const [[isLoading, token]] = useStorage<string>('token');

  return { token, isLoading };
};

export const useUserQuery = () => {
  const { isLoading: isTokenLoading } = useAuthUserToken();
  const [isLoading, setIsLoading] = useState(true);
  const logout = useLogout();

  const { refetch, data } = queryTrpc.getMe.useQuery(undefined, {
    onSuccess: () => {
      setIsLoading(false);
    },
    onError: () => {
      logout();
      setIsLoading(false);
    },
    enabled: isTokenLoading === undefined || isTokenLoading,
    retry: false,
  });

  useDeepCompareEffect(() => {
    if (data) {
      Storage.setItem('user', JSON.stringify(data));
    }
  }, [data]);

  return { user: data, isLoading, refetch };
};

export const useAuthUser = () => {
  const { user } = useUserLoader();
  const { userFromStorage } = useUserInOfflineMode();

  return user || userFromStorage || {};
};

export const useUserLoader = () => {
  const { data: user, isLoading } = queryTrpc.getMe.useQuery(undefined, {
    enabled: false,
    notifyOnChangeProps: 'all',
  });

  return { user, isLoading };
};

export const useUserInOfflineMode = () => {
  const [[isLoading, userFromStorageStr]] = useStorage('user');
  const { connectionStatus } = useOfflineStore();
  const userFromStorage = useMemo(() => {
    try {
      const parsedUserFromStorage = JSON.parse(userFromStorageStr as String);
      return parsedUserFromStorage;
    } catch {
      return null;
    }
  }, [userFromStorageStr]);

  return {
    userFromStorage: connectionStatus === 'offline' ? userFromStorage : null,
    isLoading,
  };
};
