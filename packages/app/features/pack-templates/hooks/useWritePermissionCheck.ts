import { useUser } from 'app/features/auth/hooks/useUser';
import { obs } from 'app/lib/store';
import { packTemplatesStore } from '../store';

export function useWritePermissionCheck(id: string) {
  const packTemplate = obs(packTemplatesStore, id).get();
  const user = useUser();

  return packTemplate.isAppTemplate ? user?.role === 'ADMIN' : true;
}
