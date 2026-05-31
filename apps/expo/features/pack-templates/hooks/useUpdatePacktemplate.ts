import { obs } from 'expo-app/lib/store';
import { useCallback } from 'react';
import { packTemplatesStore } from '../store/packTemplates';
import type { PackTemplate } from '../types';

export function useUpdatePackTemplate() {
  const update = useCallback((template: PackTemplate) => {
    obs({ store: packTemplatesStore, id: template.id }).set({
      ...template,
      localUpdatedAt: new Date().toISOString(),
    });
  }, []);

  return update;
}
