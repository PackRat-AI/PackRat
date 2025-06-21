import { atom } from 'jotai';
import { mockCatalogItems } from '~/data/mockData';
import type { CatalogItem } from '~/types';

export const catalogItemListAtom = atom<CatalogItem[]>([...mockCatalogItems]);
export const searchValueAtom = atom('');
