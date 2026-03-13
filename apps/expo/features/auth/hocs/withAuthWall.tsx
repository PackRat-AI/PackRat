import type { FC } from 'react';
import { isAuthed } from '../store';

// biome-ignore lint/complexity/useMaxParams: existing code - migrate to single typed object parameter
export function withAuthWall<P extends object>(Component: FC<P>, AuthWall: FC): FC<P> {
  return function WrappedComponent(props: P) {
    const isAuthenticated = isAuthed.peek();

    if (!isAuthenticated) {
      return <AuthWall />;
    }

    return <Component {...props} />;
  };
}
