import { tokenAtom } from 'expo-app/features/auth/atoms/authAtoms';
import { useAtomValue } from 'jotai';

export const useAuthenticatedQueryToolkit = () => {
  const accessToken = useAtomValue(tokenAtom);
  const isQueryEnabledWithAccessToken = Boolean(accessToken);

  return {
    isQueryEnabledWithAccessToken,
  };
};
