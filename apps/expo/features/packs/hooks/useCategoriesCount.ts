import { useCurrentPack } from './useCurrentPack';
import { usePackDetailsFromStore } from './usePackDetailsFromStore';

export function useCategoriesCount() {
  const currentPack = useCurrentPack();

  const currentPackDetails = usePackDetailsFromStore(currentPack?.id || '');

  const categoriesCount = currentPack && currentPackDetails
    ? new Set(currentPackDetails.items.map((item) => item.category)).size
    : 0;

  return categoriesCount;
}
