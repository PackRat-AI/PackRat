import { atom } from 'jotai';
import { mockPacks } from '~/data/mockData';
import type { Pack, PackCategory } from '~/types';

// Temporary mock data
export const packListAtom = atom<Pack[]>([...mockPacks]);

export const activeFilterAtom = atom<PackCategory | 'all'>('all');
export const searchValueAtom = atom<string>('');
