import { mockPacks } from 'expo-app/data/mockData';
import type { Pack, PackCategory } from 'expo-app/types';
import { atom } from 'jotai';

// Temporary mock data
export const packListAtom = atom<Pack[]>([...mockPacks]);

export const activeFilterAtom = atom<PackCategory | 'all'>('all');
export const searchValueAtom = atom<string>('');
