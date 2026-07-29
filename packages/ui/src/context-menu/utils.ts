import type { ContextItem, ContextSubMenu } from './types';

function createContextSubMenu({
  subMenu,
  items,
}: {
  subMenu: Omit<ContextSubMenu, 'items'>;
  items: ContextSubMenu['items'];
}) {
  // safe-cast: Object.assign's return type is a plain intersection, not the ContextSubMenu
  // union — merging items onto the rest of the fields genuinely produces a ContextSubMenu,
  // but TS can't express that through Object.assign's signature.
  return Object.assign(subMenu, { items }) as ContextSubMenu;
}

function createContextItem(item: ContextItem) {
  return item;
}

export { createContextSubMenu, createContextItem };
