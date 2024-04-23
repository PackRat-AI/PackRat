import { useMemo, useState } from 'react';
import { useItems } from 'app/hooks/items';
import { queryTrpc } from 'app/trpc';
import { useAuthUser } from 'app/auth/hooks';
import { useFetchSinglePack } from 'app/hooks/packs';

export const useSearchItem = () => {
  const packId = window.location.pathname.substring('/pack/'.length);
  const currentPack = useFetchSinglePack(packId);
  const { mutateAsync: addItemToPack } =
    queryTrpc.addGlobalItemToPack.useMutation();
  const utils = queryTrpc.useUtils();

  const user = useAuthUser();
  const [searchString, setSearchString] = useState('');

  const itemFilters = useMemo(() => {
    return {
      limit: 5,
      page: 0,
      searchString,
    };
  }, [searchString]);

  const { data } = useItems(itemFilters);
  const results = useMemo(() => {
    const packItems = currentPack?.data?.items;
    if (!Array.isArray(data?.items)) {
      return [];
    }

    return data.items.filter((globalItem) => {
      if (!Array.isArray(packItems)) {
        return true;
      }

      return !packItems.some(({ id }) => id === globalItem.id);
    });
  }, [data]);

  const handleSearchResultClick = (item) => {
    const ownerId = user.id;
    const packId = window.location.pathname.substring('/pack/'.length);
    const itemId = item?.id;

    (async () => {
      try {
        await addItemToPack({ itemId, ownerId, packId });
        utils.getPackById.invalidate();
      } catch {}
    })();

    return '';
  };

  return { searchString, setSearchString, results, handleSearchResultClick };
};
