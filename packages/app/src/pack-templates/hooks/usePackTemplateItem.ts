// usePackTemplateItem.ts

import { use$ } from '@legendapp/state/react';
import { packTemplateItemsStore } from '../store/packTemplateItems';

export function usePackTemplateItem(id: string) {
  const item = use$(packTemplateItemsStore[id]);
  return item;
}
