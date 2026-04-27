export * from './user';

import { observable } from '@legendapp/state';
import { userStore } from './user';

export const isAuthed = observable(() => userStore.get() !== null);
