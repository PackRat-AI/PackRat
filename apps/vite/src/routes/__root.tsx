import React, { useContext } from 'react';
import { MainContentWeb } from '@packrat/ui';
import { createRootRoute, Link, Outlet } from '@tanstack/react-router';
import { TanStackRouterDevtools } from '@tanstack/router-devtools';
import { Navbar } from 'app/components/navigation';
import { Provider } from 'app/provider';
import { NODE_ENV } from '@packrat/config';
import ThemeContext from '../../../../packages/app/context/theme';

const ThemedMainContentWeb = () => {
  const { isDark } = useContext(ThemeContext);

  const backgroundColor = isDark ? '#1A1A1D' : '#fdfbff';

  return (
    <MainContentWeb style={{ backgroundColor }}>
      <Navbar />
      <Outlet />
    </MainContentWeb>
  );
};

export const Route = createRootRoute({
  component: () => (
    <Provider>
      <ThemedMainContentWeb />
      {NODE_ENV === 'development' && <TanStackRouterDevtools />}
    </Provider>
  ),
});
