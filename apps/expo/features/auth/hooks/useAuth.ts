import { useAuthActions } from './useAuthActions';
import { useAuthState } from './useAuthState';

export function useAuth() {
  const state = useAuthState();
  const actions = useAuthActions();

  return {
    ...state,
    ...actions,
  };
}
