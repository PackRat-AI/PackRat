import { use$ } from '@legendapp/state/react';
import { getTemplateItems } from '../store/packTemplateItems';
import { packTemplatesStore } from '../store/packTemplates';
import { computePackTemplateWeights } from '../utils/computePacktemplateWeight';

// Hook to get a single pack template
export function usePackTemplateDetails(id: string) {
  const template = use$(() => {
    const template = packTemplatesStore[id].get();
    const items = getTemplateItems(id);
    return {
      ...template,
      items,
    };
  });

  return computePackTemplateWeights(template);
}
