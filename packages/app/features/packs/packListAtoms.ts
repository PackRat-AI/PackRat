import type { PackCategory } from 'app/types';
import { atom } from 'jotai';

export const activeFilterAtom = atom<PackCategory | 'all'>('all');
export const searchValueAtom = atom<string>('');
