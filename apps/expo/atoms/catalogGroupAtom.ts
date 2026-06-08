import type { CatalogItem } from 'expo-app/features/catalog/types';
import { atom } from 'jotai';

// Holds all variants of the catalog group the user tapped in the list.
// Set immediately before pushing to /catalog/[id] so the detail screen can
// show a variants list without any extra API calls.
export const catalogGroupVariantsAtom = atom<CatalogItem[]>([]);
