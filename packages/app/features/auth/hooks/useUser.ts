import { use$ } from '@legendapp/state/react';
import { userStore } from '../store';

export function useUser() {
  const user = use$(userStore);

  return user;
}
