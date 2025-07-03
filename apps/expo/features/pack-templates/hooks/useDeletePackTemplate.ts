import { useCallback } from 'react';
import { packTemplatesStore } from '../store/packTemplates';

export function useDeletePackTemplate() {
  const del = useCallback((id: string) => {
    packTemplatesStore[id].deleted.set(true);
  }, []);

  return del;
}
