'use client';
import type { WeightUnit } from '@packrat/app';
import { formatWeight as fmt, weightUnitAtom } from '@packrat/app';
import { useAtom } from 'jotai';
import type React from 'react';
import { createContext, useContext } from 'react';

interface WeightCtx {
  unit: WeightUnit;
  setUnit: (unit: WeightUnit) => void;
  toggleUnit: () => void;
  fw: (grams: number) => string;
}

const Ctx = createContext<WeightCtx>({
  unit: 'oz',
  setUnit: () => {},
  toggleUnit: () => {},
  fw: (g) => `${g}g`,
});

export function WeightProvider({ children }: { children: React.ReactNode }) {
  const [unit, setUnit] = useAtom(weightUnitAtom);
  const toggleUnit = () => setUnit((u) => (u === 'g' ? 'oz' : 'g'));
  const fw = (grams: number) => fmt(grams, unit);
  return <Ctx.Provider value={{ unit, setUnit, toggleUnit, fw }}>{children}</Ctx.Provider>;
}

export function useWeight() {
  return useContext(Ctx);
}
