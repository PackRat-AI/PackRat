import type { DropdownItem, DropdownSubMenu } from './types';

function createDropdownSubMenu(
  subMenu: Omit<DropdownSubMenu, 'items'>,
  items: DropdownSubMenu['items'],
) {
  // safe-cast: Object.assign's return type is a plain intersection, not the DropdownSubMenu
  // union — merging items onto the rest of the fields genuinely produces a DropdownSubMenu,
  // but TS can't express that through Object.assign's signature.
  return Object.assign(subMenu, { items }) as DropdownSubMenu;
}

function createDropdownItem(item: DropdownItem) {
  return item;
}

export { createDropdownSubMenu, createDropdownItem };
