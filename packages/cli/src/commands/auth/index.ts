import { defineCommand } from 'citty';

export default defineCommand({
  meta: { name: 'auth', description: 'Sign in, sign out, and inspect the PackRat session.' },
  subCommands: {
    login: () => import('./login').then((m) => m.default),
    logout: () => import('./logout').then((m) => m.default),
    register: () => import('./register').then((m) => m.default),
    refresh: () => import('./refresh').then((m) => m.default),
    whoami: () => import('./whoami').then((m) => m.default),
  },
});
