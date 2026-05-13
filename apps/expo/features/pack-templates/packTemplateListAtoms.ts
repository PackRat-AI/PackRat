import type { PackCategory } from '@packrat/api/types/constants';
import { atom } from 'jotai';

export const activeTemplateFilterAtom = atom<PackCategory | 'all'>('all');
export const templateSearchValueAtom = atom<string>('');
