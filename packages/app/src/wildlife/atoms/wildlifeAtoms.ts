import type { WildlifeIdentification } from '@packrat/app/wildlife';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { atomWithStorage, createJSONStorage, loadable } from 'jotai/utils';

// createJSONStorage handles JSON.parse/stringify internally; pass AsyncStorage directly.
const wildlifeStorage = createJSONStorage<WildlifeIdentification[]>(() => AsyncStorage);

export const baseWildlifeHistoryAtom = atomWithStorage<WildlifeIdentification[]>(
  'wildlife-history',
  [],
  wildlifeStorage,
  { getOnInit: true },
);

export const wildlifeHistoryAtom = loadable(baseWildlifeHistoryAtom);
