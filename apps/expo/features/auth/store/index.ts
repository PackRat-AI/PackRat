export * from './user';

import { observable, observe } from '@legendapp/state';
import { userStore } from './user';

export const isAuthed = observable(false);

observe(() => {
  isAuthed.set(userStore.get() !== null);
});
