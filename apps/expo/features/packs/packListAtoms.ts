import { atom } from 'jotai';
import { mockPacks } from 'expo-app/data/mockData';
import { Pack, PackCategory } from 'expo-app/types';

// Temporary mock data
export const packListAtom = atom<Pack[]>([...mockPacks]);

export const activeFilterAtom = atom<PackCategory | 'all'>('all');
export const searchValueAtom = atom<string>('');
