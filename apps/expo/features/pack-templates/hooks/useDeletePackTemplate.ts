import { useCallback } from 'react';
import { packTemplatesStore } from '../store/packTemplates';

export function useDeletePackTemplate() {
  const del = useCallback((id: string) => {
    // @ts-ignore: Safe because Legend-State uses Proxy
    packTemplatesStore[id].deleted.set(true);
  }, []);

  return del;
}
