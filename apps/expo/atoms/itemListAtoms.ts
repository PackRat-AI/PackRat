import { atom } from 'jotai';
import { mockCatalogItems } from 'expo-app/data/mockData';
import type { CatalogItem } from 'expo-app/types';

export const catalogItemListAtom = atom<CatalogItem[]>([...mockCatalogItems]);
export const searchValueAtom = atom('');
