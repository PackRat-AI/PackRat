import { useAtomValue } from 'jotai';
import { tokenAtom } from '~/features/auth/atoms/authAtoms';

export const useAuthenticatedQueryToolkit = () => {
  const accessToken = useAtomValue(tokenAtom);
  const isQueryEnabledWithAccessToken = Boolean(accessToken);

  return {
    isQueryEnabledWithAccessToken,
  };
};
