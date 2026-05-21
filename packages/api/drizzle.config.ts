import { nodeEnv } from '@packrat/env/node';
import { defineConfig } from 'drizzle-kit';

export default defineConfig({
  // Points at the in-package re-export at src/db/schema.ts, which re-exports
  // everything from @packrat/db/schema. Keeps drizzle-kit + tooling scoped
  // to packages/api without crossing the workspace boundary at config time.
  schema: './src/db/schema.ts',
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
