import { useCallback } from 'react';
import type { PackItemInput } from '../types';
import { writePackItem } from '../utils/writePackItem';

export function useCreatePackItem() {
  const createPackItem = useCallback(
    ({ packId, itemData }: { packId: string; itemData: PackItemInput }) =>
      writePackItem({ packId, itemData }),
    [],
  );

  return createPackItem;
}
