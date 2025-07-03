import { atom } from 'jotai';
import type { PackCategory } from '~/types';

export const activeFilterAtom = atom<PackCategory | 'all'>('all');
export const searchValueAtom = atom<string>('');
