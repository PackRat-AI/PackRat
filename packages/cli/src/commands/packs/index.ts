import { defineCommand } from 'citty';

export default defineCommand({
  meta: { name: 'packs', description: 'List, create, and manage your PackRat packs.' },
  subCommands: {
    list: () => import('./list').then((m) => m.default),
    get: () => import('./get').then((m) => m.default),
    create: () => import('./create').then((m) => m.default),
    delete: () => import('./delete').then((m) => m.default),
    items: () => import('./items').then((m) => m.default),
    'gap-analysis': () => import('./gap-analysis').then((m) => m.default),
  },
});
