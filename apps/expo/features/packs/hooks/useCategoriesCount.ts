import { useCurrentPack } from './useCurrentPack';
import { usePackDetails } from './usePackDetails';

export function useCategoriesCount() {
  const currentPack = useCurrentPack();

  const currentPackDetails = usePackDetails(currentPack?.id);

  const categoriesCount = currentPack
    ? new Set(currentPackDetails.items.map((item) => item.category)).size
    : 0;

  return categoriesCount;
}
