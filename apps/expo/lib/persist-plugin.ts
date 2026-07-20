import { observablePersistSqlite } from '@legendapp/state/persist-plugins/expo-sqlite';
import Storage from 'expo-app/lib/expoSqliteKvStore';

export const persistPlugin = observablePersistSqlite(Storage);
