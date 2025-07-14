import { useCallback } from 'react';
import { packTemplatesStore } from '../store/packTemplates';
import type { PackTemplate } from '../types';

export function useUpdatePackTemplate() {
  const update = useCallback((template: PackTemplate) => {
    packTemplatesStore[template.id].set({
      ...template,
      localUpdatedAt: new Date().toISOString(),
    });
  }, []);

  return update;
}
