// Default export is the `Storage` singleton from expo-sqlite/kv-store, an
// AsyncStorage-compatible store with extra synchronous methods (getItemSync,
// setItemSync). The native module has no working web build, so .web.ts backs
// the same surface with localStorage.
export { default } from 'expo-sqlite/kv-store';
