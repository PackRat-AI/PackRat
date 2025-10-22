import { useUser } from 'expo-app/features/auth/hooks/useUser';
import { packTemplatesStore } from '../store';

export function useWritePermissionCheck(id: string) {
  const packTemplate = packTemplatesStore[id].get();
  const user = useUser();

  return packTemplate.isAppTemplate ? user?.role === 'ADMIN' : true;
}
