import type { PackCategory } from '@packrat/db';
import { atom } from 'jotai';

export const activeTemplateFilterAtom = atom<PackCategory | 'all'>('all');
export const templateSearchValueAtom = atom<string>('');
