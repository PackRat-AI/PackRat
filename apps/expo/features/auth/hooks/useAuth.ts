import { useAuthState } from './useAuthState';
import { useAuthActions } from './useAuthActions';

export function useAuth() {
  const state = useAuthState();
  const actions = useAuthActions();

  return {
    ...state,
    ...actions,
  };
}
