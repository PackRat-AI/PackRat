import { useUser } from 'expo-app/features/auth/hooks/useUser';
import { obs } from 'expo-app/lib/store';
import { packTemplatesStore } from '../store';

export function useWritePermissionCheck(id: string) {
  const packTemplate = obs(packTemplatesStore, id).get();
  const user = useUser();

  return packTemplate.isAppTemplate ? user?.role === 'ADMIN' : true;
}
