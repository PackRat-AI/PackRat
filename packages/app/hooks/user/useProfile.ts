import { useFetchUserFavorites } from '../favorites';
import { useUserPacks } from '../packs';
import { useUserTrips } from '../singletrips';
import { useMatchesCurrentUser } from '../useMatchesCurrentUser';
import { useAuthUser } from '../../auth/hooks';
import { useGetUser } from './useGetUser';

export const useProfile = (id = null) => {
  const authUser = useAuthUser();
  const userId = id ?? authUser?.id;

  const isCurrentUser = useMatchesCurrentUser(userId); // TODO: Implement this hook in more components

  const {
    data: allPacks,
    isLoading: allPacksLoading,
    error: allPacksError,
  } = useUserPacks(userId); // TODO: Add enabled as parameter

  const {
    data: allTrips,
    isLoading: tripsIsLoading,
    error: tripsError,
  } = useUserTrips(userId); // TODO: Add enabled as parameter

  const {
    data: allFavorites,
    isLoading: allFavoritesLoading,
    error: allFavoritesError,
  } = useFetchUserFavorites(userId); // TODO: Add enabled as parameter

  const {
    data: userData,
    isLoading: userIsLoading,
    error: userError,
  } = useGetUser(userId);

  const user = !isCurrentUser ? userData : authUser;

  const isLoading =
    userIsLoading || allPacksLoading || tripsIsLoading || allFavoritesLoading;

  const error = userError || allPacksError || tripsError || allFavoritesError;

  const tripsCount = allTrips?.length ?? 0;
  const packsCount = allPacks?.length ?? 0;
  const favoritesCount = allFavorites?.length ?? 0;

  return {
    user,
    favoritesList: Array.isArray(allFavorites) ? allFavorites : [],
    packsList: Array.isArray(allPacks) ? allPacks : [],
    tripsList: Array.isArray(allTrips) ? allTrips : [],
    tripsCount,
    packsCount,
    favoritesCount,
    isLoading,
    error,
    isCurrentUser,
  };
};
