import AsyncStorage from '@react-native-async-storage/async-storage';
import { atom } from 'jotai';
import { atomWithStorage, createJSONStorage, loadable } from 'jotai/utils';
import type { WildlifeIdentification } from '../types';

const wildlifeStorage = createJSONStorage<WildlifeIdentification[]>(() => ({
  getItem: async (key: string) => {
    const value = await AsyncStorage.getItem(key);
    return value ? JSON.parse(value) : null;
  },
  setItem: async (key: string, value: unknown) => {
    await AsyncStorage.setItem(key, JSON.stringify(value));
  },
  removeItem: async (key: string) => {
    await AsyncStorage.removeItem(key);
  },
}));

export const baseWildlifeHistoryAtom = atomWithStorage<WildlifeIdentification[]>(
  'wildlife-history',
  [],
  wildlifeStorage,
);

export const wildlifeHistoryAtom = loadable(baseWildlifeHistoryAtom);

export const wildlifeHistoryCountAtom = atom((get) => {
  const result = get(wildlifeHistoryAtom);
  if (result.state === 'hasData') {
    return result.data.length;
  }
  return 0;
});
