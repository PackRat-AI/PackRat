import { useUser } from 'expo-app/features/auth/hooks/useUser';
import { packTemplatesStore } from '../store';

export function useWritePermissionCheck(id: string) {
  // @ts-ignore: Safe because Legend-State uses Proxy
  const packTemplate = packTemplatesStore[id].get();
  const user = useUser();

  return packTemplate.isAppTemplate ? user?.role === 'ADMIN' : true;
}
