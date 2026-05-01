import { ObservablePersistLocalStorage } from '@legendapp/state/persist-plugins/local-storage';

export const makePersistPlugin = () => new ObservablePersistLocalStorage();
