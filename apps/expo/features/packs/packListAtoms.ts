import type { PackCategory } from '@packrat/constants';
import { atom } from 'jotai';

export const activeFilterAtom = atom<PackCategory | 'all'>('all');
export const searchValueAtom = atom<string>('');
