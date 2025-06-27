import { mockCatalogItems } from 'expo-app/data/mockData';
import type { CatalogItem } from 'expo-app/types';
import { atom } from 'jotai';

export const catalogItemListAtom = atom<CatalogItem[]>([...mockCatalogItems]);
export const searchValueAtom = atom('');
