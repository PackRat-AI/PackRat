import { observablePersistSqlite } from '@legendapp/state/persist-plugins/expo-sqlite';
import Storage from 'expo-sqlite/kv-store';

export const persistPlugin = observablePersistSqlite(Storage);
