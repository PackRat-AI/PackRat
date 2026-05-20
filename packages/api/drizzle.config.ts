import { nodeEnv } from '@packrat/env/node';
import { defineConfig } from 'drizzle-kit';

export default defineConfig({
  // Schema lives in the shared @packrat/db package; this config path points at it
  // relative to packages/api. The previous in-app schema was extracted in merge
  // b14f4dbd5 ("refactor/extract-db-schemas-packages") but the drizzle.config.ts
  // pointer was left pointing at the now-deleted location.
  schema: '../db/src/schema.ts',
  out: './drizzle',
  dialect: 'postgresql',
  // Exclude OSM tables — they are managed by osm2pgsql, not Drizzle.
  // Without this, drizzle-kit push would try to drop them.
  tablesFilter: ['!osm_ways', '!osm_routes'],
  dbCredentials: {
    url:
      nodeEnv.NEON_DATABASE_URL ??
      (() => {
        throw new Error('NEON_DATABASE_URL is not set');
      })(),
  },
});
