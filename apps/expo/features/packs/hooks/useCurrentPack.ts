import { useRecentPacks } from './useRecentPacks';

export function useCurrentPack() {
  const packs = useRecentPacks();
  const currentPack = packs[0];

  return currentPack;
}
