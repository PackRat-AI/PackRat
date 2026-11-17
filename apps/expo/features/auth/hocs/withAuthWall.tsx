import { use$ } from '@legendapp/state/react';
import type { FC } from 'react';
import { isAuthed } from '../store';

export function withAuthWall<P extends object>({
  Component,
  AuthWall,
}: {
  Component: FC<P>;
  AuthWall: FC;
}): FC<P> {
  return function WrappedComponent(props: P) {
    // Reactive: signing in from the wall returns to this same screen, which must then swap to
    // the real content.
    const isAuthenticated = use$(isAuthed);

    if (!isAuthenticated) {
      return <AuthWall />;
    }

    return <Component {...props} />;
  };
}
