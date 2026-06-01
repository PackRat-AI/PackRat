// Wrapper around expo-secure-store. Import secure storage from here, never from
// `expo-secure-store` directly — the `.web` variant backs it with localStorage
// so callers don't need platform branches (expo-secure-store ships an empty stub
// on web that throws when called). Enforced by scripts/lint/no-direct-wrapped-imports.ts.
export {
  deleteItemAsync,
  getItem,
  getItemAsync,
  setItem,
  setItemAsync,
} from 'expo-secure-store';
