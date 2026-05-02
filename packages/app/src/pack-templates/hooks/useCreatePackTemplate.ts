import { obs } from '@packrat/app/lib/store';
import type { PackTemplateInput, PackTemplateInStore } from '@packrat/app/pack-templates';
import { nanoid } from 'nanoid';
import { useCallback } from 'react';
import { packTemplatesStore } from '../store/packTemplates';

export function useCreatePackTemplate() {
  const createPackTemplate = useCallback((input: PackTemplateInput) => {
    const id = nanoid();
    const timestamp = new Date().toISOString();

    const newTemplate: PackTemplateInStore = {
      id,
      ...input,
      localCreatedAt: timestamp,
      localUpdatedAt: timestamp,
      deleted: false,
    };

    obs(packTemplatesStore, id).set(newTemplate);
  }, []);

  return createPackTemplate;
}
