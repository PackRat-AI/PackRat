import { createOsmDb } from '@packrat/api/db';
import type { TrailDb } from '@packrat/api/services/trailIndex';

/** The trail database, or null when this server has none configured. */
export function trailDbOrNull(): TrailDb | null {
  try {
    return createOsmDb();
  } catch {
    return null;
  }
}
