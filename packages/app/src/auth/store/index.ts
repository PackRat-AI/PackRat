export * from './user';

import { observable } from '@legendapp/state';

// Plain (non-computed) observable so that .set(true/.false) is reliably
// reactive. The computed form (observable(() => userStore.get() !== null))
// cannot be overridden with .set() in LegendState v2 — the value only
// recomputes from its dependency, which may be deferred with syncedCrud.
export const isAuthed = observable(false);
