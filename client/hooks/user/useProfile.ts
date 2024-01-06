import { useFetchUserFavorites } from '../favorites';
import { useUserPacks } from '../packs';
import { useUserTrips } from '../singletrips';
import { useMatchesCurrentUser } from '../useMatchesCurrentUser';
import { useAuthUser } from './useAuthUser';
import { useGetUser } from './useGetUser';

export const useProfile = (id = null) => {
  const authUser = useAuthUser();

  const userId = id ?? authUser?._id;

  const isCurrentUser = useMatchesCurrentUser(userId); // TODO: Implement this hook in more components

  const {
    data: allPacks,
    isLoading: allPacksLoading,
    error: allPacksError,
  } = useUserPacks((ownerId = authUser?._id)); // TODO: Add enabled as parameter

  const {
    data: tripsData,
    isLoading: tripsIsLoading,
    error: tripsError,
  } = useUserTrips((ownerId = authUser?._id)); // TODO: Add enabled as parameter

  const {
    data: allFavorites,
    isLoading: allFavoritesLoading,
    error: allFavoritesError,
  } = useFetchUserFavorites((ownerId = authUser?._id)); // TODO: Add enabled as parameter

  const {
    data: userData,
    isLoading: userIsLoading,
    error: userError,
  } = useGetUser(id);

  const user = !isCurrentUser ? userData : authUser;

  const isLoading = !isCurrentUser
    ? userIsLoading
    : allPacksLoading || tripsIsLoading || allFavoritesLoading;

  const error = !isCurrentUser
    ? userError
    : allPacksError || tripsError || allFavoritesError;

  const packsData = !isCurrentUser ? user?.packs : allPacks;
  const favoritesData = !isCurrentUser ? user?.favorites : allFavorites;

  const tripsCount = tripsData?.length ?? 0;
  const packsCount = packsData?.length ?? 0;
  const favoritesCount = favoritesData?.length ?? 0;

  return {
    user,
    favoritesList: Array.isArray(favoritesData) ? favoritesData : [],
    packsList: Array.isArray(packsData) ? packsData : [],
    tripsList: Array.isArray(tripsData) ? tripsData : [],
    tripsCount,
    packsCount,
    favoritesCount,
    isLoading,
    error,
    isCurrentUser,
  };
};
