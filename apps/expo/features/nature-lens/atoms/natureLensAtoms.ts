import { atom } from 'jotai';
import type { NatureIdentification } from './types';

export const natureIdentificationsAtom = atom<NatureIdentification[]>([]);
export const currentIdentificationAtom = atom<NatureIdentification | null>(null);
export const isIdentifyingAtom = atom(false);
export const identificationErrorAtom = atom<string | null>(null);
