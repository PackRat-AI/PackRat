import { queryTrpc } from 'app/trpc';

interface NewItem {
  packId: string;
  ownerId: string;
  content: string;
  id?: string;
  type?: string;
}

export const useImportPackItem = () => {
  const utils = queryTrpc.useContext();
  const mutation = queryTrpc.importItems.useMutation({
    onMutate: async (newItem: NewItem | void) => {
      if (!newItem) {
        throw new Error('Item data is not available.');
      }
    },
    onSuccess: (data, newItem: NewItem | void, context) => {
      if (!newItem) return;

      const previousPack = utils.getPackById.getData({
        packId: newItem.packId,
      });

      const newQueryData = {
        ...previousPack,
        items: [
          ...(previousPack?.items ?? []),
          {
            ...newItem,
            owners: [],
            global: false,
            packs: [newItem.id],
            id: Date.now().toString(),
            category: newItem.type ? { name: newItem.type } : null,
          },
        ],
      };

      utils.getPackById.setData(
        { packId: newItem.packId },
        newQueryData as any,
      );

      utils.getPackById.invalidate();
      utils.getPacks.invalidate();
    },
    onError: (error, newItem, context) => {
      console.error('Error adding item:', error);
    },
  });

  return {
    mutation,
    importPackItem: mutation.mutate,
    isLoading: mutation.isLoading,
    isError: mutation.isError,
    error: mutation.error,
  };
};
