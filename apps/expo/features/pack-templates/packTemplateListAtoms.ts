import { atom } from 'jotai';
import type { PackCategory } from '~/types';

export const activeTemplateFilterAtom = atom<PackCategory | 'all'>('all');
export const templateSearchValueAtom = atom<string>('');
