import { tokenAtom } from '@packrat/app/auth/atoms/authAtoms';
import { useAtomValue } from 'jotai';

export const useAuthenticatedQueryToolkit = () => {
  const accessToken = useAtomValue(tokenAtom);
  const isQueryEnabledWithAccessToken = Boolean(accessToken);

  return {
    isQueryEnabledWithAccessToken,
  };
};
