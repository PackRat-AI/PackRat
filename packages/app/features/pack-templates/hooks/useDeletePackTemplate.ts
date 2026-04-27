import { obs } from 'app/lib/store';
import { useCallback } from 'react';
import { packTemplatesStore } from '../store/packTemplates';

export function useDeletePackTemplate() {
  const del = useCallback((id: string) => {
    obs(packTemplatesStore, id).deleted.set(true);
  }, []);

  return del;
}
