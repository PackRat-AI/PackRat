import { nanoid } from 'nanoid/non-secure';
import { useCallback } from 'react';
import { packTemplatesStore } from '../store/packTemplates';
import type { PackTemplateInput, PackTemplateInStore } from '../types';

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

    // @ts-ignore: Safe because Legend-State uses Proxy
    packTemplatesStore[id].set(newTemplate);
  }, []);

  return createPackTemplate;
}
