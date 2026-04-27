import { use$ } from '@legendapp/state/react';
import { useAtomValue } from 'jotai';
import { isLoadingAtom } from '../atoms/authAtoms';
import { isAuthed } from '../store';
import { useUser } from './useUser';

export function useAuthState() {
  const user = useUser();
  const isLoading = useAtomValue(isLoadingAtom);
  const isAuthenticated = use$(isAuthed);

  return {
    user,
    isLoading,
    isAuthenticated,
  };
}
