import { obs } from '@packrat/app/lib/store';
import type { PackTemplate } from '@packrat/app/pack-templates';
import { useCallback } from 'react';
import { packTemplatesStore } from '../store/packTemplates';

export function useUpdatePackTemplate() {
  const update = useCallback((template: PackTemplate) => {
    obs(packTemplatesStore, template.id).set({
      ...template,
      localUpdatedAt: new Date().toISOString(),
    });
  }, []);

  return update;
}
