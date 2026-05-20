import { defineCommand } from 'citty';

export default defineCommand({
  meta: { name: 'admin', description: 'Admin-only PackRat operations (requires admin JWT).' },
  subCommands: {
    login: () => import('./login').then((m) => m.default),
    logout: () => import('./logout').then((m) => m.default),
    stats: () => import('./stats').then((m) => m.default),
    users: () => import('./users').then((m) => m.default),
    packs: () => import('./packs').then((m) => m.default),
    catalog: () => import('./catalog').then((m) => m.default),
    trails: () => import('./trails').then((m) => m.default),
    analytics: () => import('./analytics').then((m) => m.default),
    etl: () => import('./etl').then((m) => m.default),
  },
});
