import { obs } from 'expo-app/lib/store';
import { packTemplatesStore } from '../store';

// Featured (app) templates are curated in the admin console, so they are
// read-only in the app.
export function useWritePermissionCheck(id: string) {
  const packTemplate = obs({ store: packTemplatesStore, id: id }).get();
  return !packTemplate.isAppTemplate;
}
