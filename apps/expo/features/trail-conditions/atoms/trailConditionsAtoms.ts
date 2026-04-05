import { atom } from 'jotai';
import type { TrailCondition } from './types';

export const trailConditionsAtom = atom<TrailCondition[]>([]);
export const currentTrailConditionAtom = atom<TrailCondition | null>(null);
export const isSubmittingConditionAtom = atom(false);
export const conditionErrorAtom = atom<string | null>(null);
