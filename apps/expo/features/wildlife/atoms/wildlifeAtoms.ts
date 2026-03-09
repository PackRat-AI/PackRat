import AsyncStorage from '@react-native-async-storage/async-storage';
import { atomWithStorage, createJSONStorage, loadable } from 'jotai/utils';
import type { WildlifeIdentification } from '../types';

// createJSONStorage handles JSON.parse/stringify internally; pass AsyncStorage directly.
const wildlifeStorage = createJSONStorage<WildlifeIdentification[]>(() => AsyncStorage);

export const baseWildlifeHistoryAtom = atomWithStorage<WildlifeIdentification[]>(
  'wildlife-history',
  [],
  wildlifeStorage,
  { getOnInit: true },
);

export const wildlifeHistoryAtom = loadable(baseWildlifeHistoryAtom);
