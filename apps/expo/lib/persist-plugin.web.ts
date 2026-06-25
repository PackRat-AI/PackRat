import { observablePersistAsyncStorage } from '@legendapp/state/persist-plugins/async-storage';
import AsyncStorage from 'expo-app/lib/asyncStorage';

// On web, the expo-sqlite persist plugin requires SharedArrayBuffer (COEP/COOP
// headers). Use the AsyncStorage plugin instead, which falls through to our
// localStorage-backed mock via the metro web stub.
export const persistPlugin = observablePersistAsyncStorage({ AsyncStorage });
