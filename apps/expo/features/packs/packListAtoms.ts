import type { PackCategory } from '@packrat/db';
import { atom } from 'jotai';

export const activeFilterAtom = atom<PackCategory | 'all'>('all');
export const searchValueAtom = atom<string>('');
