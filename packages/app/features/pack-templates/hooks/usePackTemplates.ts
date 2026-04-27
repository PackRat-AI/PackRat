import { use$ } from '@legendapp/state/react';
import { packTemplatesStore } from '../store/packTemplates';

export function usePackTemplates() {
  const templates = use$(() => {
    const all = Object.values(packTemplatesStore.get());
    return all.filter((t) => !t.deleted);
  });

  return templates;
}
