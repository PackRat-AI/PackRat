import { observable } from '@legendapp/state';

/**
 * The parks on the park-list goal being edited, shared with the park chooser it opens. Routes
 * can't carry the selection back, so the editor seeds this when it opens and both screens read
 * and write it.
 */
export const goalParkSelection$ = observable<string[]>([]);
