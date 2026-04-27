import type { PackCategory } from 'app/types';
import { atom } from 'jotai';

export const activeTemplateFilterAtom = atom<PackCategory | 'all'>('all');
export const templateSearchValueAtom = atom<string>('');
