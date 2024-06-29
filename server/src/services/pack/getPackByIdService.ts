import { Pack } from '../../drizzle/methods/pack';

interface ItemPack {
  item: any;
}

interface PackWithItemPacks {
  type: string | null;
  id: string;
  name: string;
  createdAt: string | null;
  updatedAt: string | null;
  owner_id: string | null;
  is_public: boolean | null;
  grades: Object | null;
  scores: Object | null;
  itemPacks: ItemPack[];
}

export const getPackByIdService = async (packId: string) => {
  try {
    const packClass = new Pack();
    const pack = (await packClass.findPack({
      id: packId,
    })) as PackWithItemPacks;
    const packData = {
      ...pack,
      scores: JSON.parse(pack.scores as string),
      grades: JSON.parse(pack.grades as string),
      total_weight: packClass.computeTotalWeight(pack),
      favorites_count: packClass.computeFavouritesCount(pack),
      total_score: packClass.computeTotalScores(pack),
      items: pack.itemPacks.map((itemPack) => itemPack.item),
    };
    return packData;
  } catch (error) {
    // Handle any potential errors here
    console.error(error);
    throw error;
  }
};
