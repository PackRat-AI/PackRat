import { useCallback } from 'react';
import { packTemplatesStore } from '../store/packTemplates';
import type { PackTemplate } from '../types';

export function useUpdatePackTemplate() {
  const update = useCallback((template: PackTemplate) => {
    // @ts-ignore: Safe because Legend-State uses Proxy
    packTemplatesStore[template.id].set({
      ...template,
      localUpdatedAt: new Date().toISOString(),
    });
  }, []);

  return update;
}
