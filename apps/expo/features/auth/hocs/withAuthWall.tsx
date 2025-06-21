import { FC } from 'react';
import { useAuth } from '../hooks/useAuth';

export function withAuthWall<P extends object>(Component: FC<P>, AuthWall: FC): FC<P> {
  return function WrappedComponent(props: P) {
    const { isAuthenticated } = useAuth();

    if (!isAuthenticated) {
      return <AuthWall />;
    }

    return <Component {...props} />;
  };
}
